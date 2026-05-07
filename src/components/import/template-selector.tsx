'use client'

import { useState, useEffect } from 'react'
import { Template } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Plus, Settings, Sparkles, Star } from 'lucide-react'
import { TemplateMapping, WAYBILL_FIELDS } from '@/types'

interface TemplateSelectorProps {
  templates: Template[]
  headers: string[]
  selectedTemplate: Template | null
  autoMatchedTemplate?: Template | null
  onSelect: (template: Template | null) => void
  onAutoMatch?: () => void
  onCreateTemplate?: (name: string, mappings: TemplateMapping) => Promise<void>
  onMappingsChange?: (mappings: TemplateMapping) => void
  currentMappings?: TemplateMapping
}

export function TemplateSelector({
  templates,
  headers,
  selectedTemplate,
  autoMatchedTemplate,
  onSelect,
  onAutoMatch,
  onCreateTemplate,
  onMappingsChange,
  currentMappings = {},
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [mappings, setMappings] = useState<TemplateMapping>(currentMappings)

  // 当选择模板时更新映射
  useEffect(() => {
    if (selectedTemplate) {
      const templateMappings = selectedTemplate.mappings as TemplateMapping
      setMappings(templateMappings)
      onMappingsChange?.(templateMappings)
    }
  }, [selectedTemplate])

  // 当手动调整映射时同步
  useEffect(() => {
    onMappingsChange?.(mappings)
  }, [mappings, onMappingsChange])

  const handleMappingChange = (field: string, column: string) => {
    setMappings(prev => ({
      ...prev,
      [field]: column,
    }))
  }

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !onCreateTemplate) return
    
    setIsCreating(true)
    try {
      await onCreateTemplate(newTemplateName.trim(), mappings)
      setIsOpen(false)
      setNewTemplateName('')
    } finally {
      setIsCreating(false)
    }
  }

  const getFieldRequired = (field: string) => {
    return WAYBILL_FIELDS.find(f => f.key === field)?.required ?? false
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          选择模板
        </CardTitle>
        <CardDescription>
          选择已保存的模板映射规则，或手动配置字段对应关系
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 模板选择 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>已保存的模板</Label>
            {templates.length > 0 && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Plus className="h-3 w-3" />
                    保存当前映射
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>保存为新模板</DialogTitle>
                    <DialogDescription>
                      将当前字段映射关系保存为模板，方便下次使用
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateName">模板名称</Label>
                      <Input
                        id="templateName"
                        placeholder="例如：我的快递模板"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      已配置 {Object.values(mappings).filter(Boolean).length} 个字段映射
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                      取消
                    </Button>
                    <Button
                      onClick={handleSaveAsTemplate}
                      disabled={!newTemplateName.trim() || isCreating}
                    >
                      {isCreating ? '保存中...' : '保存模板'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* 无模板选项 */}
            <button
              onClick={() => onSelect(null)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                !selectedTemplate
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="font-medium text-sm">不指定模板</div>
              <div className="text-xs text-muted-foreground">手动映射所有字段</div>
            </button>

            {/* 自动匹配提示 */}
            {autoMatchedTemplate && !selectedTemplate && (
              <button
                onClick={() => onSelect(autoMatchedTemplate)}
                className="p-3 rounded-lg border-2 border-dashed border-green-500 bg-green-50 text-left transition-colors hover:border-green-600"
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-green-500" />
                  <span className="font-medium text-sm text-green-600">智能匹配</span>
                </div>
                <div className="text-xs text-green-600">{autoMatchedTemplate.name}</div>
              </button>
            )}

            {/* 已有模板 */}
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{template.name}</span>
                  {template.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  已使用 {(template as Template & { useCount?: number }).useCount || 0} 次
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 字段映射配置 */}
        <div className="space-y-3">
          <Label>字段映射</Label>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-40">系统字段</th>
                  <th className="px-3 py-2 text-left font-medium">Excel 列名</th>
                  <th className="px-3 py-2 text-left font-medium w-20">必填</th>
                </tr>
              </thead>
              <tbody>
                {WAYBILL_FIELDS.map((field) => (
                  <tr key={field.key} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium">{field.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={mappings[field.key] || ''}
                        onValueChange={(value) => handleMappingChange(field.key, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="选择列..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">不映射</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {field.required ? (
                        <span className="text-destructive text-xs">*</span>
                      ) : (
                        <CheckCircle className="h-3 w-3 text-muted-foreground mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p className="text-xs text-muted-foreground">
            已配置 {Object.values(mappings).filter(Boolean).length} / {WAYBILL_FIELDS.length} 个字段映射
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
