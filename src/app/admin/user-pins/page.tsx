/**
 * User PINs Management Page (Admin Only)
 * CRUD interface for managing user PINs
 */

import { Metadata } from 'next';
import UserPinsClient from './UserPinsClient';

export const metadata: Metadata = {
  title: 'จัดการ PIN ผู้ใช้งาน',
  description: 'Admin interface for managing user authentication PINs',
};

export default function UserPinsPage() {
  return <UserPinsClient />;
}
