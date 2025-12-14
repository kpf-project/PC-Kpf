import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import * as supabaseLogs from '@/lib/supabaseLogs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupportType = 'bug' | 'suggestion' | 'question';

interface SupportRequest {
  type: SupportType;
  message: string;
  user: {
    name: string;
    id: string | null;
    role: string;
  };
  context: {
    url: string;
    userAgent: string;
    timestamp: string;
  };
}

/**
 * Send notification to Discord Webhook
 */
async function sendDiscordNotification(payload: SupportRequest): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Support] DISCORD_WEBHOOK_URL not configured, skipping Discord notification');
    return;
  }

  const typeEmoji = {
    bug: '🐛',
    suggestion: '💡',
    question: '❓',
  };

  const typeLabel = {
    bug: 'แจ้งปัญหา',
    suggestion: 'เสนอแนะ',
    question: 'สอบถาม',
  };

  const typeColor = {
    bug: 15158332, // Red
    suggestion: 16776960, // Yellow
    question: 3447003, // Blue
  };

  const roleLabel: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ',
    super_admin: 'Super Admin',
    sales: 'พนักงานขาย',
    employee: 'พนักงาน',
  };

  // Parse device info from user agent
  const isMobile = /Mobile|Android|iPhone|iPad/.test(payload.context.userAgent);
  const device = isMobile ? '📱 Mobile' : '💻 Desktop';

  // Format timestamp
  const timestamp = new Date(payload.context.timestamp).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Create Discord embed message
  const embed = {
    title: `${typeEmoji[payload.type]} ${typeLabel[payload.type]}ใหม่จากระบบ`,
    description: `**ข้อความ:**\n${payload.message}`,
    color: typeColor[payload.type],
    fields: [
      {
        name: '👤 ผู้แจ้ง',
        value: `${payload.user.name}${payload.user.id ? ` (${payload.user.id})` : ''}`,
        inline: true,
      },
      {
        name: '🏢 บทบาท',
        value: roleLabel[payload.user.role] || payload.user.role,
        inline: true,
      },
      {
        name: '📱 อุปกรณ์',
        value: device,
        inline: true,
      },
      {
        name: '🌐 หน้า',
        value: payload.context.url,
        inline: false,
      },
    ],
    footer: {
      text: `เวลา: ${timestamp}`,
    },
    timestamp: payload.context.timestamp,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Support Bot',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/6134/6134346.png',
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    console.log('[Support] Discord notification sent successfully');
  } catch (error) {
    console.error('[Support] Failed to send Discord notification:', error);
    // Don't throw - we don't want Discord failures to block the main operation
  }
}

/**
 * Save support message to Supabase
 */
async function saveSupportMessage(payload: SupportRequest): Promise<string> {
  const supabase = getSupabaseServiceClient();

  // Type assertion for support_messages table (not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('support_messages')
    .insert({
      type: payload.type,
      message: payload.message,
      user_name: payload.user.name,
      user_id: payload.user.id,
      user_role: payload.user.role,
      context_url: payload.context.url,
      context_user_agent: payload.context.userAgent,
      submitted_at: payload.context.timestamp,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Support] Failed to save to Supabase:', error);
    throw new Error('ไม่สามารถบันทึกข้อมูลได้');
  }

  return data.id;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<SupportRequest>;

    // Validate input
    if (!payload.type || !['bug', 'suggestion', 'question'].includes(payload.type)) {
      return NextResponse.json(
        { success: false, error: 'ประเภทไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    if (!payload.message || payload.message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อความ' },
        { status: 400 }
      );
    }

    const validPayload: SupportRequest = {
      type: payload.type as SupportType,
      message: payload.message.trim(),
      user: {
        name: payload.user?.name || 'ไม่ระบุชื่อ',
        id: payload.user?.id || null,
        role: payload.user?.role || 'unknown',
      },
      context: {
        url: payload.context?.url || 'unknown',
        userAgent: payload.context?.userAgent || 'unknown',
        timestamp: payload.context?.timestamp || new Date().toISOString(),
      },
    };

    // Save to Supabase
    const messageId = await saveSupportMessage(validPayload);

    // Send Discord notification (non-blocking, don't fail if Discord fails)
    sendDiscordNotification(validPayload).catch((error) => {
      console.error('[Support] Discord notification failed, but message was saved:', error);
    });

    // Log the action
    await supabaseLogs.addLog({
      timestamp: validPayload.context.timestamp,
      scope: 'support',
      action: 'create',
      details: `ส่งข้อความ${validPayload.type === 'bug' ? 'แจ้งปัญหา' : validPayload.type === 'suggestion' ? 'เสนอแนะ' : 'สอบถาม'}`,
      actorName: validPayload.user.name,
      actorId: validPayload.user.id,
      metadata: {
        type: validPayload.type,
        messageId,
        url: validPayload.context.url,
      },
    });

    return NextResponse.json({
      success: true,
      messageId,
    });
  } catch (error) {
    console.error('[Support] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
      },
      { status: 500 }
    );
  }
}
