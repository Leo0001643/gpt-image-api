// Command worker 异步任务消费者（asynq）。
//
// 监听队列：critical / default / low
// 详见 docs/02-后端规范.md §8。
package main

import (
	"context"
	"encoding/json"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"

	"github.com/gpt-image-api/backend/internal/bootstrap"
	"github.com/gpt-image-api/backend/internal/provider/factory"
	"github.com/gpt-image-api/backend/internal/repo"
	"github.com/gpt-image-api/backend/internal/service"
	"github.com/gpt-image-api/backend/pkg/logger"
)

const serviceName = "worker"

// Task type 常量（与发布端保持一致）。
const (
	TaskGenImage    = "gen:image"
	TaskGenVideo    = "gen:video"
	TaskPoolHealth  = "pool:health"
	TaskBillSettle  = "bill:settle"
	TaskEmailSend   = "email:send"
	TaskWebhookSend = "webhook:notify"
)

func main() {
	deps, err := bootstrap.Init(serviceName)
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	if deps.Cfg.Redis.Addr == "" {
		logger.L().Fatal("worker requires redis")
	}

	// 构建 GenerationService 供 gen:image / gen:video handler 使用
	var genSvc *service.GenerationService
	if deps.DB != nil {
		accountRepo := repo.NewAccountRepo(deps.DB)
		genRepo := repo.NewGenerationRepo(deps.DB)
		walletRepo := repo.NewWalletRepo(deps.DB)
		sysCfgRepo := repo.NewSystemConfigRepo(deps.DB)
		proxyRepo := repo.NewProxyRepo(deps.DB)

		sysCfgSvc := service.NewSystemConfigService(sysCfgRepo)
		proxySvc := service.NewProxyService(proxyRepo, deps.AES)
		billingSvc := service.NewBillingService(deps.DB, walletRepo)
		pool := service.NewAccountPool(accountRepo, 30*time.Second)
		providers := factory.Build()

		genSvc = service.NewGenerationService(
			deps.DB, genRepo, pool, billingSvc, providers,
			service.ConfigPriceFn(sysCfgSvc), deps.AES, proxySvc, sysCfgSvc,
		)

		service.NewGrokCFRefreshService(sysCfgSvc, proxySvc).Start(context.Background())
	}

	srv := asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:     deps.Cfg.Redis.Addr,
			Password: deps.Cfg.Redis.Password,
			DB:       deps.Cfg.Redis.DB,
		},
		asynq.Config{
			Concurrency: 16,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
			Logger:          &asynqZap{l: logger.L()},
			ShutdownTimeout: deps.Cfg.Server.ShutdownTimeout,
			HealthCheckFunc: func(err error) {
				if err != nil {
					logger.L().Warn("asynq health", zap.Error(err))
				}
			},
		},
	)

	mux := asynq.NewServeMux()

	mux.HandleFunc(TaskPoolHealth, func(ctx context.Context, t *asynq.Task) error {
		logger.FromCtx(ctx).Info("pool health tick", zap.String("task", t.Type()))
		return nil
	})

	// gen:image / gen:video — 由 GenerationService.RunTask 负责执行
	makeGenHandler := func(kind string) asynq.HandlerFunc {
		return func(ctx context.Context, t *asynq.Task) error {
			if genSvc == nil {
				return nil
			}
			var payload service.GenTaskPayload
			if err := json.Unmarshal(t.Payload(), &payload); err != nil {
				return err
			}
			task, err := repo.NewGenerationRepo(deps.DB).GetByTaskID(ctx, payload.TaskID)
			if err != nil {
				logger.FromCtx(ctx).Warn("gen worker: task not found",
					zap.String("task_id", payload.TaskID), zap.Error(err))
				return nil // 不重试
			}
			logger.FromCtx(ctx).Info("gen worker: start",
				zap.String("task_id", task.TaskID), zap.String("kind", kind))
			genSvc.RunTask(ctx, task)
			return nil
		}
	}
	mux.HandleFunc(TaskGenImage, makeGenHandler("image"))
	mux.HandleFunc(TaskGenVideo, makeGenHandler("video"))

	go func() {
		if err := srv.Run(mux); err != nil {
			logger.L().Fatal("asynq run", zap.Error(err))
		}
	}()

	logger.L().Info("worker started", zap.String("redis", deps.Cfg.Redis.Addr))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	srv.Shutdown()
	logger.L().Info("worker shutdown done")
}

// asynqZap 把 asynq 日志转 zap。
type asynqZap struct{ l *zap.Logger }

func (a *asynqZap) Debug(args ...any) { a.l.Sugar().Debug(args...) }
func (a *asynqZap) Info(args ...any)  { a.l.Sugar().Info(args...) }
func (a *asynqZap) Warn(args ...any)  { a.l.Sugar().Warn(args...) }
func (a *asynqZap) Error(args ...any) { a.l.Sugar().Error(args...) }
func (a *asynqZap) Fatal(args ...any) { a.l.Sugar().Fatal(args...) }
