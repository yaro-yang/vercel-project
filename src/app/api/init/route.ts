import { NextResponse } from 'next/server'
import { initPresetTemplates } from '@/actions/templates'

export async function POST() {
  try {
    await initPresetTemplates()
    return NextResponse.json({ success: true, message: 'Preset templates initialized' })
  } catch (error) {
    console.error('Failed to initialize templates:', error)
    return NextResponse.json(
      { error: 'Failed to initialize templates' },
      { status: 500 }
    )
  }
}
