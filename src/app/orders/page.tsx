"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Upload,
  FileSpreadsheet,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
} from "lucide-react";
import type { Order, OrderStatus } from "@/types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "待处理", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  CONFIRMED: { label: "已确认", color: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  PROCESSING: { label: "处理中", color: "bg-purple-100 text-purple-800", icon: <Package className="w-3 h-3" /> },
  SHIPPED: { label: "已发货", color: "bg-indigo-100 text-indigo-800", icon: <Truck className="w-3 h-3" /> },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-800", icon: <XCircle className="w-3 h-3" /> },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    search: "",
    status: "ALL" as OrderStatus | "ALL" | "",
  });
  const [stats, setStats] = useState({ total: 0, pending: 0, processing: 0, completed: 0, todayCount: 0 });

  // 加载订单列表
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);

      const [ordersRes, statsRes] = await Promise.all([
        fetch(`/api/orders?${params.toString()}`),
        fetch("/api/orders/stats"),
      ]);

      const ordersData = await ordersRes.json();
      const statsData = await statsRes.json();

      if (ordersData.success) {
        setOrders(ordersData.orders);
        setPagination((prev) => ({
          ...prev,
          total: ordersData.total,
          totalPages: ordersData.totalPages,
        }));
      }

      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error("Load orders error:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // 状态筛选
  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value as OrderStatus | "ALL" }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // 分页
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">运单管理</h1>
            <div className="flex items-center space-x-3">
              <Link href="/orders/import">
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  导入运单
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-500">总运单数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">待处理</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-600">{stats.processing}</div>
              <div className="text-sm text-gray-500">处理中</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">已完成</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.todayCount}</div>
              <div className="text-sm text-gray-500">今日新增</div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选栏 */}
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索订单号、外部编码、收件人姓名、电话..."
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filters.status || 'ALL'} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="订单状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部状态</SelectItem>
                  <SelectItem value="PENDING">待处理</SelectItem>
                  <SelectItem value="CONFIRMED">已确认</SelectItem>
                  <SelectItem value="PROCESSING">处理中</SelectItem>
                  <SelectItem value="SHIPPED">已发货</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 订单列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">运单列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-4 text-gray-500">暂无运单数据</p>
                <Link href="/orders/import" className="mt-4 inline-block">
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    去导入
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">订单号</TableHead>
                        <TableHead className="w-[100px]">外部编码</TableHead>
                        <TableHead className="w-[100px]">温层</TableHead>
                        <TableHead>收件人</TableHead>
                        <TableHead className="w-[120px]">联系电话</TableHead>
                        <TableHead className="w-[200px]">收件地址</TableHead>
                        <TableHead className="w-[80px] text-center">件数</TableHead>
                        <TableHead className="w-[80px] text-right">重量(kg)</TableHead>
                        <TableHead className="w-[100px]">状态</TableHead>
                        <TableHead className="w-[160px]">导入时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                          <TableCell className="text-gray-500">{order.externalCode || "-"}</TableCell>
                          <TableCell>
                            {order.temperature && (
                              <Badge variant="outline">{order.temperature}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{order.receiverName}</TableCell>
                          <TableCell className="text-gray-500">{order.receiverPhone || "-"}</TableCell>
                          <TableCell className="text-gray-500 truncate max-w-[200px]" title={order.receiverAddress}>
                            {order.receiverAddress || "-"}
                          </TableCell>
                          <TableCell className="text-center">{order.quantity || "-"}</TableCell>
                          <TableCell className="text-right">{order.weight || "-"}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[order.status].color}>
                              <span className="flex items-center gap-1">
                                {STATUS_CONFIG[order.status].icon}
                                {STATUS_CONFIG[order.status].label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {new Date(order.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-gray-500">
                      共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.page <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.page >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.page - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={pagination.page === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-9"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
