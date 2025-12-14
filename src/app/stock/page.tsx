import { Metadata } from "next";
import StockManagementClient from "./StockManagementClient";

export const metadata: Metadata = {
  title: "จัดการสต็อกสินค้า | Attendance Tracker",
  description: "หน้าจัดการสต็อกสินค้าสำหรับพนักงาน รองรับการรับเข้า ตรวจสอบคงเหลือ และรับคืน",
  openGraph: {
    title: "จัดการสต็อกสินค้า | Attendance Tracker",
    description: "หน้าจัดการสต็อกสินค้าสำหรับพนักงาน",
  },
};

export default function StockPage() {
  return <StockManagementClient />;
}
