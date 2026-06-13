import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight, ChevronLeft, ChevronRight, CreditCard, Gift, Key,
  ListFilter, RefreshCw, Search, ShoppingCart, Tag, TrendingDown, TrendingUp, Undo2, Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { FilterSelect } from '../../components/FilterSelect';
import { billingApi } from '../../lib/services';
import type { AdminWalletLogItem } from '../../lib/types';
import { fmtNumber, fmtPoints, fmtTime } from '../../lib/format';

type BizType = '' | 'recharge' | 'consume' | 'refund' | 'cdk' | 'promo' | 'invite_reward' | 'gift';
type Direction = '' | '1' | '-1';

const BIZ_OPTIONS = [
  { value: ''             as BizType, label: '全部业务', icon: <ListFilter size={13}/>,   iconColor: '#6366f1' },
  { value: 'recharge'     as BizType, label: '充值',     icon: <CreditCard size={13}/>,   iconColor: '#10b981' },
  { value: 'consume'      as BizType, label: '消费',     icon: <ShoppingCart size={13}/>, iconColor: '#8b5cf6' },
  { value: 'refund'       as BizType, label: '退款',     icon: <Undo2 size={13}/>,        iconColor: '#f59e0b' },
  { value: 'cdk'          as BizType, label: '兑换码',   icon: <Key size={13}/>,           iconColor: '#3b82f6' },
  { value: 'promo'        as BizType, label: '优惠码',   icon: <Tag size={13}/>,           iconColor: '#ec4899' },
  { value: 'invite_reward'as BizType, label: '邀请奖励', icon: <Gift size={13}/>,          iconColor: '#f97316' },
  { value: 'gift'         as BizType, label: '赠送',     icon: <Gift size={13}/>,          iconColor: '#14b8a6' },
];

const DIR_OPTIONS = [
  { value: ''   as Direction, label: '收支方向', icon: <ArrowLeftRight size={13}/>, iconColor: '#6366f1' },
  { value: '1'  as Direction, label: '收入',     icon: <TrendingUp size={13}/>,     iconColor: '#10b981' },
  { value: '-1' as Direction, label: '支出',     icon: <TrendingDown size={13}/>,   iconColor: '#f43f5e' },
];

export default function BillingPage() {
  const [keyword, setKeyword] = useState('');
  const [userID, setUserID] = useState('');
  const [bizType, setBizType] = useState<BizType>('');
  const [direction, setDirection] = useState<Direction>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useQuery({
    queryKey: ['admin', 'billing', 'wallet-logs', keyword, userID, bizType, direction, page],
    queryFn: () => billingApi.walletLogs({
      keyword: keyword.trim() || undefined,
      user_id: Number(userID) || undefined,
      biz_type: bizType || undefined,
      direction: direction ? Number(direction) as 1 | -1 : undefined,
      page,
      page_size: pageSize,
    }),
  });

  const rows = query.data?.list ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const summary = useMemo(() => {
    let income = 0;
    let outcome = 0;
    for (const row of rows) {
      if (row.direction > 0) income += row.points;
      if (row.direction < 0) outcome += Math.abs(row.points);
    }
    return { income, outcome };
  }, [rows]);

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#10b981,#34d399)',boxShadow:'0 4px 14px rgba(16,185,129,.35)'}}>
            <Wallet size={16}/>
          </div>
          <div>
            <div className="list-page-title">充值消费记录</div>
            <div className="list-page-subtitle">查看用户积分流水，包含充值、消费、退款、兑换码、优惠码和人工调整</div>
          </div>
          <div className="list-divider"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-blue"><span className="stat-pill-dot"/><span className="stat-pill-label">总记录</span><span className="stat-pill-val">{fmtNumber(total)}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">当页收入</span><span className="stat-pill-val">{fmtPoints(summary.income)}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">当页支出</span><span className="stat-pill-val">{fmtPoints(summary.outcome)}</span></span>
          </div>
          <div className="ml-auto">
            <button className="btn btn-outline btn-sm" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={13} className={query.isFetching ? 'animate-spin' : ''}/> 刷新
            </button>
          </div>
        </div>
        <div className="list-page-filter-row">
          <div className="search-wrap">
            <Search size={13}/>
            <input className="filter-input" style={{width:240}} placeholder="搜索流水ID、用户、业务ID、备注"
              value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
          <input className="filter-input" style={{width:90}} value={userID} onChange={(e) => { setUserID(e.target.value); setPage(1); }} placeholder="用户ID"/>
          <FilterSelect value={bizType} onChange={(v) => { setBizType(v); setPage(1); }} options={BIZ_OPTIONS} />
          <FilterSelect value={direction} onChange={(v) => { setDirection(v); setPage(1); }} options={DIR_OPTIONS} />
          <div className="ml-auto filter-count">共 <strong>{fmtNumber(total)}</strong> 条</div>
        </div>
      </div>

      <div className="list-page-body">
        <div className="table-wrap">
        <table className="data-table min-w-[1120px]">
          <thead>
            <tr>
              <th><span className="th-icon" style={{justifyContent:'flex-start'}}>时间</span></th>
              <th><span className="th-icon" style={{justifyContent:'flex-start'}}>用户</span></th>
              <th><span className="th-icon">业务</span></th>
              <th><span className="th-icon" style={{justifyContent:'flex-start'}}>业务ID</span></th>
              <th><span className="th-icon">方向</span></th>
              <th><span className="th-icon">变动积分</span></th>
              <th><span className="th-icon">变动前</span></th>
              <th><span className="th-icon">变动后</span></th>
              <th><span className="th-icon" style={{justifyContent:'flex-start'}}>备注</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <LogRow key={row.id} row={row} />)}
            {!query.isLoading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-text-tertiary">暂无记录</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <div className="list-page-pager">
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'linear-gradient(135deg,#10b981,#34d399)'}}/>
            <span>共 <strong style={{color:'#10b981'}}>{fmtNumber(total)}</strong> 条流水 · 第 <strong style={{color:'#374151'}}>{page}</strong> 页</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn btn-outline btn-sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={13}/> 上一页</button>
            <span style={{fontSize:12,color:'#374151'}}>{page} / {pages}</span>
            <button className="btn btn-outline btn-sm" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>下一页 <ChevronRight size={13}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogRow({ row }: { row: AdminWalletLogItem }) {
  const isIncome = row.direction > 0;
  return (
    <tr>
      <td className="whitespace-nowrap">{fmtTime(row.created_at)}</td>
      <td>
        <div className="font-medium text-text-primary">{row.user_label || `用户 ${row.user_id}`}</div>
        <div className="text-tiny text-text-tertiary">ID {row.user_id}</div>
      </td>
      <td><span className="badge badge-outline">{bizLabel(row.biz_type)}</span></td>
      <td className="font-mono text-small max-w-[220px] truncate" title={row.biz_id}>{row.biz_id}</td>
      <td><span className={isIncome ? 'badge badge-success' : 'badge badge-danger'}>{isIncome ? '收入' : '支出'}</span></td>
      <td className={isIncome ? 'text-success font-semibold tabular-nums' : 'text-danger font-semibold tabular-nums'}>
        {isIncome ? '+' : '-'}{fmtPoints(Math.abs(row.points))}
      </td>
      <td className="tabular-nums">{fmtPoints(row.points_before)}</td>
      <td className="tabular-nums">{fmtPoints(row.points_after)}</td>
      <td className="max-w-[240px] truncate" title={row.remark}>{row.remark || '-'}</td>
    </tr>
  );
}

function bizLabel(v: string) {
  return BIZ_OPTIONS.find((o) => o.value === v)?.label || v || '-';
}
