import BackupManagementClient from './BackupManagementClient';

export const metadata = {
  title: 'Backup Management - Admin',
  description: 'Production backup and restore system (Super Admin only)',
};

export default function BackupManagementPage() {
  return <BackupManagementClient />;
}
