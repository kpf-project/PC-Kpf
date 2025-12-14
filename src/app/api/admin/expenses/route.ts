import { NextResponse } from "next/server";
import {
  listExpenses,
  upsertExpense,
  deleteExpense,
  type ExpenseEntry,
} from "@/lib/supabaseExpenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const expenses = await listExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Failed to list expenses", error);
    return NextResponse.json(
      { message: "ไม่สามารถดึงข้อมูลค่าใช้จ่ายได้" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { expense?: ExpenseEntry };
    const expense = body.expense;
    if (!expense || typeof expense.id !== "string") {
      return NextResponse.json(
        { message: "ข้อมูลไม่ครบถ้วน" },
        { status: 400 },
      );
    }

    await upsertExpense(expense);
    const expenses = await listExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Failed to persist expenses", error);
    return NextResponse.json(
      { message: "ไม่สามารถบันทึกข้อมูลค่าใช้จ่ายได้" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id;
    if (!id) {
      return NextResponse.json(
        { message: "ไม่พบรหัสค่าใช้จ่ายที่ต้องการลบ" },
        { status: 400 },
      );
    }

    await deleteExpense(id);
    const expenses = await listExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Failed to delete expense", error);
    return NextResponse.json(
      { message: "ไม่สามารถลบข้อมูลค่าใช้จ่ายได้" },
      { status: 500 },
    );
  }
}
