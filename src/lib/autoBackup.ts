import { promises as fs } from "fs";
import path from "path";

/**
 * Auto Backup System for app-data.json
 * Creates timestamped backups to prevent data loss
 */

const DATA_FILE = path.join(process.cwd(), "data", "app-data.json");
const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const MAX_BACKUPS = 10; // Keep last 10 backups

/**
 * Create a timestamped backup of app-data.json
 */
export async function createBackup(): Promise<string | null> {
  try {
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Read current data
    const data = await fs.readFile(DATA_FILE, "utf-8");

    // Create timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(BACKUP_DIR, `app-data-${timestamp}.json`);

    // Write backup
    await fs.writeFile(backupFile, data, "utf-8");

    // Clean old backups
    await cleanOldBackups();

    return backupFile;
  } catch (error) {
    console.error("❌ Backup failed:", error);
    return null;
  }
}

/**
 * Keep only the most recent backups
 */
async function cleanOldBackups(): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter((f) => f.startsWith("app-data-") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
      }))
      .sort((a, b) => b.name.localeCompare(a.name)); // Sort by timestamp descending

    // Delete old backups
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      await Promise.all(filesToDelete.map((f) => fs.unlink(f.path)));
    }
  } catch (error) {
    console.error("⚠️  Failed to clean old backups:", error);
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<Array<{ name: string; path: string; timestamp: Date }>> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter((f) => f.startsWith("app-data-") && f.endsWith(".json"))
      .map((f) => {
        const timestampStr = f.replace("app-data-", "").replace(".json", "");
        // Convert format: 2025-10-21T09-28-28-983Z -> 2025-10-21T09:28:28.983Z
        const isoStr = timestampStr.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z");
        const timestamp = new Date(isoStr);
        return {
          name: f,
          path: path.join(BACKUP_DIR, f),
          timestamp,
        };
      })
      .filter((f) => !Number.isNaN(f.timestamp.getTime())) // Filter out invalid dates
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backupFiles;
  } catch (error) {
    console.error("❌ Failed to list backups:", error);
    return [];
  }
}

/**
 * Restore from a backup file
 */
export async function restoreFromBackup(backupFileName: string): Promise<boolean> {
  try {
    const backupFile = path.join(BACKUP_DIR, backupFileName);
    const data = await fs.readFile(backupFile, "utf-8");

    // Validate JSON
    JSON.parse(data);

    // Create a backup of current file before restoring
    await createBackup();

    // Restore
    await fs.writeFile(DATA_FILE, data, "utf-8");

    return true;
  } catch (error) {
    console.error("❌ Restore failed:", error);
    return false;
  }
}
