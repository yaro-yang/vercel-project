# 万能导入 - 多模板自动导入下单系统

基于 Next.js 15 + Prisma + Neon PostgreSQL 的订单批量导入系统。

## 功能特性

- 支持 Excel (.xlsx, .xls)、CSV、JSON 多种文件格式
- 灵活配置字段映射规则
- 数据预览与编辑
- 批量导入订单
- 订单状态管理

## 技术栈

- **框架**: Next.js 15 App Router
- **语言**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **表格**: TanStack Table v8
- **数据库**: Prisma + Neon PostgreSQL
- **部署**: Vercel

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置数据库连接:

```env
DATABASE_URL="postgresql://username:password@host/neondb?sslmode=require"
```

### 3. 初始化数据库

```bash
npm run db:push
npm run db:generate
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Vercel

1. 在 Vercel Dashboard 创建新项目
2. 添加环境变量 `DATABASE_URL`
3. 部署会自动运行 `prisma generate`

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── api/              # API Routes
│   ├── components/       # React 组件
│   ├── lib/              # 工具库
│   └── types/            # TypeScript 类型
├── prisma/
│   └── schema.prisma     # 数据库模型
└── public/               # 静态资源
```

## License

MIT
