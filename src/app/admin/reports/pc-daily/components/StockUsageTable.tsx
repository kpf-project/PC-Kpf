"use client";

type PCStockUsage = {
  id: string;
  report_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantities: Record<string, number>;
  total_base_units: number;
  created_at: string;
};

type Props = {
  stockUsage: PCStockUsage[];
};

export function StockUsageTable({ stockUsage }: Props) {
  if (stockUsage.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
        ไม่มีข้อมูลสินค้าที่แกะ
      </div>
    );
  }

  // Display quantities and base units

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700"
              >
                สินค้า
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-700"
              >
                จำนวน
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {stockUsage.map((item) => {
              // Format quantities display
              const quantityParts: string[] = [];
              const quantities = item.quantities as Record<string, number>;

              // Common unit names in Thai
              const unitOrder = ["ลัง", "แพ็ค", "ซอง", "กล่อง", "ชิ้น"];

              // Sort by custom order if possible, otherwise alphabetically
              const sortedUnits = Object.keys(quantities).sort((a, b) => {
                const aIndex = unitOrder.indexOf(a);
                const bIndex = unitOrder.indexOf(b);

                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b, "th");
              });

              for (const unit of sortedUnits) {
                const qty = quantities[unit];
                if (qty > 0) {
                  quantityParts.push(`${qty} ${unit}`);
                }
              }

              const quantityDisplay = quantityParts.length > 0
                ? quantityParts.join(" ")
                : "ไม่มีข้อมูล";

              return (
                <tr key={item.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">
                        {item.product_name}
                      </span>
                      <span className="text-xs text-slate-500">{item.product_code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{quantityDisplay}</span>
                    {item.total_base_units > 0 && (
                      <span className="ml-2 text-xs text-slate-500">
                        (รวม {item.total_base_units} หน่วยฐาน)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row (optional) */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            รวมทั้งหมด
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {stockUsage.length} รายการ
          </span>
        </div>
      </div>
    </div>
  );
}
