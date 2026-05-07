import { getTemplates } from '@/actions/templates'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'

export default async function TemplatesPage() {
  const templates = await getTemplates()

  const typeLabels: Record<string, string> = {
    STANDARD: '标准订单',
    EXPRESS: '快递单',
    WHOLESALE: '批发单',
    CUSTOM: '自定义',
  }

  const fileTypeLabels: Record<string, string> = {
    EXCEL: 'Excel',
    CSV: 'CSV',
    JSON: 'JSON',
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">模板管理</h1>
          <p className="text-muted-foreground mt-1">
            管理导入模板，配置字段映射规则
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无模板</h3>
            <p className="text-muted-foreground">
              在导入订单时创建第一个模板
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className={!template.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    {template.isDefault && (
                      <Badge variant="default" className="mt-1">默认</Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{typeLabels[template.type]}</Badge>
                    <Badge variant="outline">{fileTypeLabels[template.fileType]}</Badge>
                    {!template.isActive && <Badge variant="destructive">已禁用</Badge>}
                  </div>
                  
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium mb-2">字段映射</p>
                    <div className="space-y-1">
                      {Object.entries(template.mappings as Record<string, string>).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                      {Object.keys(template.mappings as Record<string, string>).length > 4 && (
                        <p className="text-xs text-muted-foreground">
                          还有 {Object.keys(template.mappings as Record<string, string>).length - 4} 个字段...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
