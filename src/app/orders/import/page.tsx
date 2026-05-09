"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { 
  parseExcel, 
  autoMatchFields, 
  applyFieldMapping, 
  validateAllData,
  exportToExcel,
  STANDARD_FIELDS,
  TEMPERATURE_OPTIONS,
} from "@/lib/parsers/excel";
import type { FieldMapping } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Trash2,
  Plus,
  Loader2,
  RefreshCw,
  Info,
  Table2,
  Sparkles,
} from "lucide-react";
import type { ParsedData, ParseError, Template } from "@/types";

// 导入步骤
type ImportStep = "upload" | "mapping" | "preview" | "result";

interface ImportState {
  step: ImportStep;
  file: File | null;
  headers: string[];
  rawData: unknown[][];
  headerRow: number;
  sheetNames: string[];
  selectedSheet: number;
  mapping: FieldMapping;
  data: ParsedData[];
  errors: ParseError[];
  templates: Template[];
  selectedTemplateId: string | null;
  isProcessing: boolean;
  progress: number;
  importResult: { success: number; failed: number; batchId: string } | null;
}

const initialState: ImportState = {
  step: "upload",
  file: null,
  headers: [],
  rawData: [],
  headerRow: 0,
  sheetNames: [],
  selectedSheet: 0,
  mapping: {},
  data: [],
  errors: [],
  templates: [],
  selectedTemplateId: null,
  isProcessing: false,
  progress: 0,
  importResult: null,
};

export default function ImportPage() {
  const [state, setState] = useState<ImportState>(initialState);
  const [editableData, setEditableData] = useState<ParsedData[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [tempMapping, setTempMapping] = useState<FieldMapping>({});
  const [newRows, setNewRows] = useState<Set<number>>(new Set());
  const [templateMatchInfo, setTemplateMatchInfo] = useState<{ name: string; similarity: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 加载模板列表
  useEffect(() => {
    loadTemplates();
  }, []);



  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setState((prev) => ({ ...prev, templates: data.templates || [] }));
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  // 文件上传处理
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert("请上传 Excel 文件 (.xlsx 或 .xls)");
      return;
    }

    setState((prev) => ({ 
      ...prev, 
      isProcessing: true, 
      progress: 0,
      file,
      step: "upload"
    }));

    try {
      const result = await parseExcel(file, {
        sheetIndex: 0,
        onProgress: (p) => setState((prev) => ({ ...prev, progress: p.percent }))
      });

      console.log("[Upload] Parsed result:", {
        headers: result.headers,
        rawDataLength: result.rawData.length,
        rawDataSample: result.rawData.slice(0, 2),
        headerRow: result.headerRow,
      });

      if (result.errors.length > 0 && result.rawData.length === 0) {
        alert(result.errors.map((e) => e.message).join("\n"));
        setState((prev) => ({ ...prev, isProcessing: false, progress: 0 }));
        return;
      }

      // 自动匹配字段
      const autoMapping = autoMatchFields(result.headers);
      console.log("[Upload] Auto mapping:", autoMapping);

      // 尝试从已有模板中找最佳匹配
      let matchInfo: { name: string; similarity: number } | null = null;
      if (result.headers.length > 0) {
        try {
          const matchRes = await fetch("/api/templates/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers: result.headers }),
          });
          const matchData = await matchRes.json();
          if (matchData.template) {
            matchInfo = { name: matchData.template.name, similarity: matchData.similarity };
          }
        } catch (e) {
          // 忽略模板匹配错误
        }
      }

      setTemplateMatchInfo(matchInfo);

      const hasAutoMapping = Object.keys(autoMapping).length > 0;
      setTempMapping(hasAutoMapping ? autoMapping : {});

      // 如果有自动映射，先转换数据
      let transformedData: ParsedData[] = [];
      let validData: ParsedData[] = [];
      let allErrors: ParseError[] = [];
      
      if (hasAutoMapping) {
        transformedData = applyFieldMapping(result.rawData, result.headers, autoMapping);
        console.log("[Upload] Transformed data:", {
          length: transformedData.length,
          autoMapping,
          sample: transformedData.slice(0, 2),
        });
        
        // 检查数据库重复
        const externalCodes = transformedData
          .map((row) => row.externalCode)
          .filter((code) => code && String(code).trim());
        
        console.log("[Upload] External codes to check:", externalCodes);
        
        let dbDuplicates: Array<{ externalCode: string; orderNo: string; status: string }> = [];
        if (externalCodes.length > 0) {
          try {
            console.log("[Upload] Calling check-duplicates API...");
            const dupRes = await fetch("/api/orders/check-duplicates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ externalCodes }),
            });
            const dupData = await dupRes.json();
            console.log("[Upload] Check duplicates result:", dupData);
            if (dupData.duplicates) {
              dbDuplicates = dupData.duplicates;
            }
          } catch (e) {
            console.error("[Upload] Check duplicates error:", e);
          }
        } else {
          console.log("[Upload] No external codes found to check");
        }
        
        // 为重复的外部编码添加错误
        if (dbDuplicates.length > 0) {
          console.log("[Upload] Found duplicates:", dbDuplicates);
          const dupMap = new Map(dbDuplicates.map((d) => [d.externalCode.toLowerCase(), d]));
          transformedData.forEach((row, idx) => {
            if (row.externalCode && dupMap.has(String(row.externalCode).toLowerCase())) {
              const dup = dupMap.get(String(row.externalCode).toLowerCase())!;
              row._errors = row._errors || [];
              row._errors.push({
                type: "DUPLICATE_ERROR",
                row: row._rowIndex,
                field: "externalCode",
                message: `外部编码已存在（运单号: ${dup.orderNo}，状态: ${dup.status}）`,
              });
            }
          });
        }
        
        const validationResult = validateAllData(transformedData);
        validData = validationResult.validData;
        allErrors = validationResult.allErrors;
        console.log("[Upload] Validation result:", {
          validCount: validData.length,
          errorCount: allErrors.length,
          dbDuplicates: dbDuplicates.length,
        });
      }

      // 设置状态
      setState((prev) => ({
        ...prev,
        headers: result.headers,
        rawData: result.rawData,
        headerRow: result.headerRow,
        sheetNames: result.sheetNames,
        selectedSheet: 0,
        mapping: hasAutoMapping ? autoMapping : {},
        data: validData,
        errors: allErrors,
        isProcessing: false,
        progress: 100,
        step: hasAutoMapping ? "preview" : "mapping",
      }));

      // 设置 editableData
      if (hasAutoMapping) {
        setEditableData(transformedData);
        setNewRows(new Set());
      } else {
        setEditableData([]);
        setNewRows(new Set());
      }
      setEditingCell(null);

    } catch (error) {
      console.error("Parse error:", error);
      alert("文件解析失败");
      setState((prev) => ({ ...prev, isProcessing: false, progress: 0 }));
    }
  }, []);

  // 切换 Sheet
  const handleSheetChange = useCallback(async (sheetIndex: number) => {
    if (!state.file) return;

    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const result = await parseExcel(state.file, {
        sheetIndex,
        onProgress: (p) => setState((prev) => ({ ...prev, progress: p.percent }))
      });

      const autoMapping = autoMatchFields(result.headers);
      const hasAutoMapping = Object.keys(autoMapping).length > 0;

      setTempMapping(hasAutoMapping ? autoMapping : {});

      // 如果有自动映射，先转换数据
      let transformedData: ParsedData[] = [];
      let validData: ParsedData[] = [];
      let allErrors: ParseError[] = [];
      
      if (hasAutoMapping) {
        transformedData = applyFieldMapping(result.rawData, result.headers, autoMapping);
        
        // 检查数据库重复
        const externalCodes = transformedData
          .map((row) => row.externalCode)
          .filter((code) => code && String(code).trim());
        
        let dbDuplicates: Array<{ externalCode: string; orderNo: string; status: string }> = [];
        if (externalCodes.length > 0) {
          try {
            const dupRes = await fetch("/api/orders/check-duplicates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ externalCodes }),
            });
            const dupData = await dupRes.json();
            if (dupData.duplicates) {
              dbDuplicates = dupData.duplicates;
            }
          } catch (e) {
            console.error("Check duplicates error:", e);
          }
        }
        
        // 为重复的外部编码添加错误
        if (dbDuplicates.length > 0) {
          const dupMap = new Map(dbDuplicates.map((d) => [d.externalCode.toLowerCase(), d]));
          transformedData.forEach((row) => {
            if (row.externalCode && dupMap.has(String(row.externalCode).toLowerCase())) {
              const dup = dupMap.get(String(row.externalCode).toLowerCase())!;
              row._errors = row._errors || [];
              row._errors.push({
                type: "DUPLICATE_ERROR",
                row: row._rowIndex,
                field: "externalCode",
                message: `外部编码已存在（运单号: ${dup.orderNo}，状态: ${dup.status}）`,
              });
            }
          });
        }
        
        const validationResult = validateAllData(transformedData);
        validData = validationResult.validData;
        allErrors = validationResult.allErrors;
      }

      setState((prev) => ({
        ...prev,
        headers: result.headers,
        rawData: result.rawData,
        headerRow: result.headerRow,
        selectedSheet: sheetIndex,
        mapping: hasAutoMapping ? autoMapping : {},
        data: validData,
        errors: allErrors,
        step: hasAutoMapping ? "preview" : "mapping",
        isProcessing: false,
      }));

      // 如果有自动映射，设置转换后的数据
      if (hasAutoMapping) {
        setEditableData(transformedData);
        setNewRows(new Set());
      } else {
        setEditableData([]);
        setNewRows(new Set());
      }
      setEditingCell(null);
    } catch (error) {
      console.error("Sheet change error:", error);
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  }, [state.file]);

  // 拖放处理
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // 应用映射并转换数据
  const applyMapping = useCallback(async () => {
    const mappingToUse = tempMapping;
    const data = applyFieldMapping(state.rawData, state.headers, mappingToUse, (p) => {
      setState((prev) => ({ ...prev, progress: p.percent }));
    });

    // 检查数据库重复
    const externalCodes = data
      .map((row) => row.externalCode)
      .filter((code) => code && String(code).trim());
    
    let dbDuplicates: Array<{ externalCode: string; orderNo: string; status: string }> = [];
    if (externalCodes.length > 0) {
      try {
        const dupRes = await fetch("/api/orders/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalCodes }),
        });
        const dupData = await dupRes.json();
        if (dupData.duplicates) {
          dbDuplicates = dupData.duplicates;
        }
      } catch (e) {
        console.error("Check duplicates error:", e);
      }
    }
    
    // 为重复的外部编码添加错误
    if (dbDuplicates.length > 0) {
      const dupMap = new Map(dbDuplicates.map((d) => [d.externalCode.toLowerCase(), d]));
      data.forEach((row) => {
        if (row.externalCode && dupMap.has(String(row.externalCode).toLowerCase())) {
          const dup = dupMap.get(String(row.externalCode).toLowerCase())!;
          row._errors = row._errors || [];
          row._errors.push({
            type: "DUPLICATE_ERROR",
            row: row._rowIndex,
            field: "externalCode",
            message: `外部编码已存在（运单号: ${dup.orderNo}，状态: ${dup.status}）`,
          });
        }
      });
    }

    const { validData, allErrors } = validateAllData(data);

    setState((prev) => ({ 
      ...prev, 
      data: validData, 
      errors: allErrors,
      mapping: mappingToUse,
      step: "preview"
    }));

    setEditableData([...data]);
    setNewRows(new Set());
  }, [state.rawData, state.headers, tempMapping]);

  // 更新单元格
  const handleCellEdit = useCallback((rowIndex: number, field: string, value: string) => {
    setEditableData((prev) => {
      const newData = [...prev];
      const row = { ...newData[rowIndex] };
      
      if (field === "weight") {
        row.weight = value === "" ? undefined : parseFloat(value);
      } else if (field === "quantity") {
        row.quantity = value === "" ? undefined : parseInt(value, 10);
      } else {
        row[field as keyof ParsedData] = value as never;
      }
      
      const rowErrors = validateRow(row, row._rowIndex);
      row._errors = rowErrors;
      row._isModified = true;
      
      newData[rowIndex] = row;
      return newData;
    });
  }, []);

  // 验证单行（重量、件数、温层为选填）
  const validateRow = (row: ParsedData, rowIndex: number): ParseError[] => {
    const errors: ParseError[] = [];

    const requiredFields = [
      { key: "senderName", label: "寄件人姓名" },
      { key: "receiverName", label: "收件人姓名" },
      { key: "receiverAddress", label: "收件人地址" },
    ];

    for (const field of requiredFields) {
      const value = row[field.key];
      if (value === undefined || value === null || value === "") {
        errors.push({
          type: "VALIDATION_ERROR",
          row: rowIndex,
          field: field.key,
          message: `${field.label}为必填项`,
        });
      }
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    const loosePhoneRegex = /^\d{11}$/;
    
    if (row.senderPhone) {
      const phone = String(row.senderPhone).replace(/\s/g, "").replace(/-/g, "");
      if (!phoneRegex.test(phone) && !loosePhoneRegex.test(phone)) {
        errors.push({
          type: "VALIDATION_ERROR",
          row: rowIndex,
          field: "senderPhone",
          message: "寄件人电话格式错误",
        });
      }
    }
    if (row.receiverPhone) {
      const phone = String(row.receiverPhone).replace(/\s/g, "").replace(/-/g, "");
      if (!phoneRegex.test(phone) && !loosePhoneRegex.test(phone)) {
        errors.push({
          type: "VALIDATION_ERROR",
          row: rowIndex,
          field: "receiverPhone",
          message: "收件人电话格式错误",
        });
      }
    }

    if (row.weight !== undefined && row.weight !== null && (isNaN(Number(row.weight)) || Number(row.weight) <= 0)) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "weight",
        message: "重量必须为正数",
      });
    }

    if (row.quantity !== undefined && row.quantity !== null && (isNaN(Number(row.quantity)) || Number(row.quantity) <= 0)) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "quantity",
        message: "件数必须为正整数",
      });
    }

    if (row.temperature && !TEMPERATURE_OPTIONS.includes(String(row.temperature))) {
      errors.push({
        type: "VALIDATION_ERROR",
        row: rowIndex,
        field: "temperature",
        message: `温层值必须在 [${TEMPERATURE_OPTIONS.join(", ")}] 范围内`,
      });
    }

    return errors;
  };

  // 删除行
  const handleDeleteRow = useCallback((rowIndex: number) => {
    setEditableData((prev) => prev.filter((_, i) => i !== rowIndex));
    setNewRows((prev) => {
      const newSet = new Set(prev);
      newSet.delete(rowIndex);
      return newSet;
    });
  }, []);

  // 新增行
  const handleAddRow = useCallback(() => {
    const newRow: ParsedData = {
      _rowIndex: editableData.length + 1,
      _errors: [],
      _isNew: true,
    };
    setEditableData((prev) => [...prev, newRow]);
    setNewRows((prev) => new Set([...prev, editableData.length]));
  }, [editableData.length]);

  // 删除错误行
  const handleDeleteErrorRows = useCallback(() => {
    setEditableData((prev) => prev.filter((row) => row._errors.length === 0));
    setNewRows(new Set());
  }, []);

  // 导出 Excel
  const handleExport = useCallback(() => {
    exportToExcel(editableData, `导入预览_${new Date().toLocaleDateString()}.xlsx`);
  }, [editableData]);

  // 提交订单
  const handleSubmit = useCallback(async () => {
    const rowsWithErrors = editableData.filter((row) => row._errors.length > 0);
    if (rowsWithErrors.length > 0) {
      alert(`仍有 ${rowsWithErrors.length} 条数据存在错误，请先修正`);
      return;
    }

    setState((prev) => ({ ...prev, isProcessing: true, progress: 0 }));

    try {
      const response = await fetch("/api/orders/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orders: editableData,
          filename: state.file?.name,
        }),
      });

      const result = await response.json();

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        progress: 100,
        step: "result",
        importResult: {
          success: result.successCount || 0,
          failed: result.failedCount || 0,
          batchId: result.batchId || "",
        },
      }));
    } catch (error) {
      console.error("Submit error:", error);
      alert("提交失败，请重试");
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  }, [editableData, state.file]);

  // 重新验证
  const handleRevalidate = useCallback(() => {
    setEditableData((prev) => {
      const newData = prev.map((row) => {
        const errors = validateRow(row, row._rowIndex);
        return { ...row, _errors: errors };
      });
      return newData;
    });
  }, []);

  // 保存模板
  const handleSaveTemplate = useCallback(async (templateName: string) => {
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          mappings: tempMapping,
          headers: state.headers,
          fileType: "EXCEL",
        }),
      });
      alert("模板保存成功");
      loadTemplates();
    } catch (error) {
      console.error("Save template error:", error);
      alert("模板保存失败");
    }
  }, [tempMapping, state.headers]);

  // 获取字段错误
  const getFieldError = (row: ParsedData, field: string): string | undefined => {
    return row._errors.find((e) => e.field === field)?.message;
  };

  // 统计错误
  const errorStats = useMemo(() => {
    const stats: Record<string, number> = {};
    editableData.forEach((row) => {
      row._errors.forEach((e) => {
        if (e.field) {
          stats[e.field] = (stats[e.field] || 0) + 1;
        }
      });
    });
    return stats;
  }, [editableData]);

  const rowsWithErrors = editableData.filter((row) => row._errors.length > 0).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">订单导入</h1>
            <div className="flex items-center space-x-2">
              {state.step !== "upload" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setState({ ...initialState, templates: state.templates });
                    setEditableData([]);
                    setNewRows(new Set());
                    setEditingCell(null);
                    setTempMapping({});
                    setTemplateMatchInfo(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  重新上传
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            {["上传文件", "字段映射", "预览编辑", "完成"].map((step, index) => {
              const stepKey: ImportStep = ["upload", "mapping", "preview", "result"][index] as ImportStep;
              const isActive = state.step === stepKey;
              const isCompleted = 
                (index === 0 && (state.step !== "upload")) ||
                (index === 1 && state.step === "preview") ||
                (index === 2 && state.step === "result") ||
                (index === 3 && state.step === "result");

              return (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center ${isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive ? "bg-blue-600 text-white" : isCompleted ? "bg-green-600 text-white" : "bg-gray-200"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                    </div>
                    <span className="ml-2 text-sm font-medium">{step}</span>
                  </div>
                  {index < 3 && (
                    <div className={`w-16 h-0.5 mx-4 ${isCompleted ? "bg-green-600" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 步骤1: 上传文件 */}
        {state.step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                上传 Excel 文件
              </CardTitle>
            </CardHeader>
            <CardContent>
              {state.isProcessing ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
                  <p className="mt-4 text-gray-600">正在解析文件...</p>
                  <Progress value={state.progress} className="mt-4 max-w-md mx-auto" />
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400" />
                  <p className="mt-4 text-lg font-medium text-gray-600">
                    拖拽文件到此处，或点击选择文件
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    支持 .xlsx 和 .xls 格式，支持多种模板格式
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </div>
              )}

              {/* 多 Sheet 提示 */}
              {state.sheetNames.length > 1 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center text-blue-700">
                    <Info className="w-4 h-4 mr-2" />
                    <span className="font-medium">检测到 {state.sheetNames.length} 个工作表：</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {state.sheetNames.map((name, idx) => (
                      <Badge key={idx} variant="outline" className="bg-white">
                        {name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-blue-600 mt-2">
                    请在导入页面选择正确的工作表
                  </p>
                </div>
              )}

              {/* 模板选择 */}
              {state.templates.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">或选择已有模板</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {state.templates.map((template) => (
                      <button
                        key={template.id}
                        className="p-4 border rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                        onClick={() => {
                          const savedMapping = template.mappings as FieldMapping;
                          setTempMapping(savedMapping);
                          setState((prev) => ({ ...prev, step: "preview" }));
                        }}
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 步骤2: 字段映射 */}
        {state.step === "mapping" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>字段映射配置</CardTitle>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="输入模板名称保存"
                    className="w-48"
                    id="templateName"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const name = (document.getElementById("templateName") as HTMLInputElement)?.value;
                      if (name) handleSaveTemplate(name);
                    }}
                  >
                    保存模板
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 文件信息 */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileSpreadsheet className="w-5 h-5 text-gray-500 mr-2" />
                    <span className="font-medium">{state.file?.name}</span>
                  </div>
                  {templateMatchInfo && (
                    <Badge className="bg-green-100 text-green-700">
                      <Sparkles className="w-3 h-3 mr-1" />
                      自动匹配模板: {templateMatchInfo.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Sheet 选择 */}
              {state.sheetNames.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择工作表</label>
                  <div className="flex flex-wrap gap-2">
                    {state.sheetNames.map((name, idx) => (
                      <Button
                        key={idx}
                        variant={state.selectedSheet === idx ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSheetChange(idx)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 表头信息 */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center text-blue-700">
                  <Info className="w-4 h-4 mr-2" />
                  <span className="text-sm">
                    检测到表头行: 第 {state.headerRow + 1} 行 | 共 {state.headers.length} 列 | {state.rawData.length} 条数据
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {state.headers.slice(0, 10).map((h, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white text-xs">
                      {h}
                    </Badge>
                  ))}
                  {state.headers.length > 10 && (
                    <Badge variant="outline" className="bg-white text-xs">
                      +{state.headers.length - 10} 更多
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                请将 Excel 列与系统字段一一对应。系统已自动识别部分映射，您可根据需要调整。
              </p>
              
              <div className="space-y-4">
                {STANDARD_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center space-x-4">
                    <div className="w-32 text-right">
                      <span className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </div>
                    <select
                      value={tempMapping[field.key] || ""}
                      onChange={(e) => setTempMapping((prev: Record<string, string>) => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1 border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">-- 不映射 --</option>
                      {state.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {tempMapping[field.key] ? (
                      <span className="text-green-600 text-sm flex items-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : field.required ? (
                      <span className="text-orange-500 text-sm">待配置</span>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* 自动匹配状态 */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">映射状态</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {STANDARD_FIELDS.map((field) => (
                    <div key={field.key} className={`text-sm ${tempMapping[field.key] ? "text-green-600" : field.required ? "text-orange-500" : "text-gray-400"}`}>
                      {tempMapping[field.key] ? "✓" : "○"} {field.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "upload" }))}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                </Button>
                <Button onClick={applyMapping}>
                  应用映射并预览 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 步骤3: 预览编辑 */}
        {state.step === "preview" && (
          <div className="space-y-4">
            {/* 工具栏 */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleAddRow}>
                      <Plus className="w-4 h-4 mr-1" /> 新增行
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRevalidate}>
                      <RefreshCw className="w-4 h-4 mr-1" /> 重新验证
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-1" /> 导出 Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setState((prev) => ({ ...prev, step: "mapping" }))}>
                      <Table2 className="w-4 h-4 mr-1" /> 调整映射
                    </Button>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      共 <strong>{editableData.length}</strong> 条
                    </span>
                    {rowsWithErrors > 0 && (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {rowsWithErrors} 条有错误
                      </Badge>
                    )}
                    {rowsWithErrors > 0 && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={handleDeleteErrorRows}>
                        删除错误行
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 错误汇总 */}
            {rowsWithErrors > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="py-3">
                  <CardTitle className="text-red-700 flex items-center text-base">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    错误汇总 ({rowsWithErrors} 行有问题)
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(errorStats).map(([field, count]) => (
                      <Badge key={field} variant="outline" className="bg-white">
                        {STANDARD_FIELDS.find((f) => f.key === field)?.label || field}: {count} 个错误
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-red-600">
                    <Info className="w-4 h-4 inline mr-1" />
                    请修正以下错误后重新验证：
                    <ul className="mt-1 ml-4 list-disc">
                      {editableData
                        .filter((row) => row._errors.length > 0)
                        .slice(0, 10)
                        .map((row) => (
                          <li key={row._rowIndex}>
                            <strong>第 {row._rowIndex} 行</strong>：
                            {row._errors.map((e) => e.message).join("; ")}
                          </li>
                        ))}
                      {rowsWithErrors > 10 && (
                        <li>...还有 {rowsWithErrors - 10} 个错误</li>
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 数据表格 */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[600px]" ref={scrollContainerRef}>
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="border px-3 py-3 text-left text-xs font-medium text-gray-600 w-12">行号</th>
                        <th className="border px-3 py-3 text-left text-xs font-medium text-gray-600 w-12">状态</th>
                        {STANDARD_FIELDS.map((field) => (
                          <th key={field.key} className="border px-3 py-3 text-left text-xs font-medium text-gray-600 min-w-[120px]">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </th>
                        ))}
                        <th className="border px-3 py-3 text-left text-xs font-medium text-gray-600 w-20">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableData.map((row, rowIndex) => {
                        const hasErrors = row._errors.length > 0;
                        const isNew = newRows.has(rowIndex);

                        return (
                          <tr key={rowIndex} className={`hover:bg-gray-50 ${hasErrors ? "bg-red-50" : ""}`}>
                            <td className="border px-3 py-2 text-sm text-gray-500">{row._rowIndex}</td>
                            <td className="border px-3 py-2">
                              {isNew ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">新增</Badge>
                              ) : hasErrors ? (
                                <Badge variant="destructive">错误</Badge>
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              )}
                            </td>
                            {STANDARD_FIELDS.map((field) => {
                              const fieldError = getFieldError(row, field.key);
                              const isEditing = editingCell?.row === rowIndex && editingCell?.field === field.key;

                              return (
                                <td key={field.key} className={`border px-2 py-1 ${fieldError ? "bg-red-100" : ""}`}>
                                  {isEditing ? (
                                    field.key === "temperature" ? (
                                      <select
                                        value={String(row[field.key as keyof ParsedData] || "")}
                                        onChange={(e) => {
                                          handleCellEdit(rowIndex, field.key, e.target.value);
                                          setEditingCell(null);
                                        }}
                                        onBlur={() => setEditingCell(null)}
                                        autoFocus
                                        className="w-full border rounded px-2 py-1 text-sm"
                                      >
                                        <option value="">请选择</option>
                                        {TEMPERATURE_OPTIONS.map((opt) => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={field.key === "weight" || field.key === "quantity" ? "number" : "text"}
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => {
                                          handleCellEdit(rowIndex, field.key, editValue);
                                          setEditingCell(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleCellEdit(rowIndex, field.key, editValue);
                                            setEditingCell(null);
                                          } else if (e.key === "Escape") {
                                            setEditingCell(null);
                                          }
                                        }}
                                        autoFocus
                                        className="w-full border rounded px-2 py-1 text-sm"
                                      />
                                    )
                                  ) : (
                                    <div
                                      className={`px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 rounded min-h-[28px] flex items-center ${
                                        fieldError ? "text-red-600" : ""
                                      }`}
                                      onClick={() => {
                                        setEditingCell({ row: rowIndex, field: field.key });
                                        setEditValue(String(row[field.key as keyof ParsedData] || ""));
                                      }}
                                      title={fieldError || String(row[field.key as keyof ParsedData] || "")}
                                    >
                                      {fieldError ? (
                                        <span className="flex items-center">
                                          <AlertCircle className="w-3 h-3 mr-1 text-red-500 flex-shrink-0" />
                                          <span className="truncate">{String(row[field.key as keyof ParsedData] || "")}</span>
                                        </span>
                                      ) : (
                                        <span className="truncate">{String(row[field.key as keyof ParsedData] || "-")}</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="border px-3 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteRow(rowIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 提交按钮 */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "mapping" }))}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> 返回映射
                  </Button>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {editableData.length - rowsWithErrors} 条有效数据
                    </span>
                    <Button
                      size="lg"
                      disabled={rowsWithErrors > 0 || editableData.length === 0}
                      onClick={handleSubmit}
                    >
                      提交下单 ({editableData.length - rowsWithErrors} 条)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 步骤4: 完成 */}
        {state.step === "result" && state.importResult && (
          <Card>
            <CardContent className="py-12 text-center">
              {state.importResult.success > 0 ? (
                <>
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
                  <h2 className="mt-4 text-2xl font-bold text-gray-900">导入成功</h2>
                  <p className="mt-2 text-gray-600">
                    成功导入 <strong className="text-green-600">{state.importResult.success}</strong> 条订单
                  </p>
                  {state.importResult.failed > 0 && (
                    <p className="text-red-600">
                      失败 <strong>{state.importResult.failed}</strong> 条
                    </p>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="w-16 h-16 mx-auto text-red-500" />
                  <h2 className="mt-4 text-2xl font-bold text-gray-900">导入失败</h2>
                  <p className="mt-2 text-gray-600">请检查数据后重试</p>
                </>
              )}
              <div className="mt-8 flex justify-center space-x-4">
                <Button variant="outline" onClick={() => window.location.href = "/orders"}>
                  查看订单列表
                </Button>
                <Button onClick={() => {
                  setState({ ...initialState, templates: state.templates });
                  setEditableData([]);
                  setNewRows(new Set());
                  setEditingCell(null);
                  setTempMapping({});
                  setTemplateMatchInfo(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}>
                  继续导入
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 加载状态 */}
        {state.isProcessing && state.step !== "upload" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-80">
              <CardContent className="py-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
                <p className="mt-4 text-gray-600">处理中...</p>
                <Progress value={state.progress} className="mt-4" />
                <p className="mt-2 text-sm text-gray-500">{state.progress}%</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
