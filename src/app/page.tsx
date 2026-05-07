import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, ListChecks, Settings, ArrowRight, Package, TrendingUp, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 顶部导航 */}
      <header className="bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FileSpreadsheet className="w-8 h-8 text-blue-600 mr-3" />
              <span className="text-xl font-bold text-gray-900">万能导入</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/templates">
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  模板管理
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero 区域 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            多模板自动导入下单系统
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            支持 Excel 多格式导入、智能模板匹配、在线编辑预览、一键批量下单
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/orders/import">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-5 h-5 mr-2" />
                开始导入
              </Button>
            </Link>
            <Link href="/orders">
              <Button size="lg" variant="outline">
                <ListChecks className="w-5 h-5 mr-2" />
                查看运单
              </Button>
            </Link>
          </div>
        </div>

        {/* 功能卡片 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>多格式支持</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                支持 Excel (.xlsx/.xls) 文件上传，拖拽或点击即可导入
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>智能模板</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                自动识别列名映射，记忆学习映射规则，下次导入自动应用
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <ListChecks className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>在线预览</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                导入后在线预览编辑，类似 Excel 操作体验，实时校验数据
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>批量下单</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                支持 1000+ 数据批量导入，实时进度显示，一键提交下单
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* 快速开始 */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">快速开始</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">上传 Excel 文件</h3>
                <p className="text-sm text-gray-500 mt-1">
                  点击或拖拽上传准备好的订单 Excel 文件
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">确认字段映射</h3>
                <p className="text-sm text-gray-500 mt-1">
                  系统自动识别列名，可手动调整映射关系
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">预览并提交</h3>
                <p className="text-sm text-gray-500 mt-1">
                  编辑修正数据，确认无误后一键提交下单
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">1000+</div>
              <div className="text-gray-500 mt-1">单次导入上限</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">3步</div>
              <div className="text-gray-500 mt-1">完成导入</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">实时</div>
              <div className="text-gray-500 mt-1">错误校验</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">智能</div>
              <div className="text-gray-500 mt-1">模板学习</div>
            </div>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="mt-16 py-8 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          万能导入 - 多模板自动导入下单系统 | Powered by Next.js + Prisma + Neon
        </div>
      </footer>
    </div>
  );
}
