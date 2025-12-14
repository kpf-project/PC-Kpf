export const THAI_REGIONS = [
  "ภาคเหนือ",
  "อีสานบน",
  "อีสานล่าง",
  "ภาคกลาง",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
  "ภาคใต้",
] as const;

export type ThaiRegionName = (typeof THAI_REGIONS)[number];

export type ThaiProvince = {
  name: string;
  region: ThaiRegionName;
};

export const THAI_PROVINCES: ThaiProvince[] = [
  // ภาคเหนือ
  { name: "เชียงใหม่", region: "ภาคเหนือ" },
  { name: "เชียงราย", region: "ภาคเหนือ" },
  { name: "ลำพูน", region: "ภาคเหนือ" },
  { name: "ลำปาง", region: "ภาคเหนือ" },
  { name: "แพร่", region: "ภาคเหนือ" },
  { name: "น่าน", region: "ภาคเหนือ" },
  { name: "พะเยา", region: "ภาคเหนือ" },
  { name: "แม่ฮ่องสอน", region: "ภาคเหนือ" },
  { name: "อุตรดิตถ์", region: "ภาคเหนือ" },
  { name: "พิษณุโลก", region: "ภาคเหนือ" },
  { name: "พิจิตร", region: "ภาคเหนือ" },
  { name: "สุโขทัย", region: "ภาคเหนือ" },
  { name: "กำแพงเพชร", region: "ภาคเหนือ" },
  { name: "เพชรบูรณ์", region: "ภาคเหนือ" },
  { name: "นครสวรรค์", region: "ภาคเหนือ" },
  { name: "อุทัยธานี", region: "ภาคเหนือ" },

  // อีสานบน
  { name: "เลย", region: "อีสานบน" },
  { name: "หนองคาย", region: "อีสานบน" },
  { name: "บึงกาฬ", region: "อีสานบน" },
  { name: "หนองบัวลำภู", region: "อีสานบน" },
  { name: "อุดรธานี", region: "อีสานบน" },
  { name: "สกลนคร", region: "อีสานบน" },
  { name: "นครพนม", region: "อีสานบน" },
  { name: "มุกดาหาร", region: "อีสานบน" },
  { name: "กาฬสินธุ์", region: "อีสานบน" },
  { name: "ขอนแก่น", region: "อีสานบน" },
  { name: "มหาสารคาม", region: "อีสานบน" },

  // อีสานล่าง
  { name: "ชัยภูมิ", region: "อีสานล่าง" },
  { name: "นครราชสีมา", region: "อีสานล่าง" },
  { name: "บุรีรัมย์", region: "อีสานล่าง" },
  { name: "สุรินทร์", region: "อีสานล่าง" },
  { name: "ศรีสะเกษ", region: "อีสานล่าง" },
  { name: "ร้อยเอ็ด", region: "อีสานล่าง" },
  { name: "ยโสธร", region: "อีสานล่าง" },
  { name: "อำนาจเจริญ", region: "อีสานล่าง" },
  { name: "อุบลราชธานี", region: "อีสานล่าง" },

  // ภาคกลาง
  { name: "กรุงเทพมหานคร", region: "ภาคกลาง" },
  { name: "นนทบุรี", region: "ภาคกลาง" },
  { name: "ปทุมธานี", region: "ภาคกลาง" },
  { name: "พระนครศรีอยุธยา", region: "ภาคกลาง" },
  { name: "อ่างทอง", region: "ภาคกลาง" },
  { name: "ลพบุรี", region: "ภาคกลาง" },
  { name: "สิงห์บุรี", region: "ภาคกลาง" },
  { name: "ชัยนาท", region: "ภาคกลาง" },
  { name: "สระบุรี", region: "ภาคกลาง" },
  { name: "นครนายก", region: "ภาคกลาง" },
  { name: "นครปฐม", region: "ภาคกลาง" },
  { name: "สมุทรปราการ", region: "ภาคกลาง" },
  { name: "สมุทรสาคร", region: "ภาคกลาง" },
  { name: "สมุทรสงคราม", region: "ภาคกลาง" },
  { name: "สุพรรณบุรี", region: "ภาคกลาง" },

  // ภาคตะวันออก
  { name: "ฉะเชิงเทรา", region: "ภาคตะวันออก" },
  { name: "ชลบุรี", region: "ภาคตะวันออก" },
  { name: "ระยอง", region: "ภาคตะวันออก" },
  { name: "จันทบุรี", region: "ภาคตะวันออก" },
  { name: "ตราด", region: "ภาคตะวันออก" },
  { name: "ปราจีนบุรี", region: "ภาคตะวันออก" },
  { name: "สระแก้ว", region: "ภาคตะวันออก" },

  // ภาคตะวันตก
  { name: "กาญจนบุรี", region: "ภาคตะวันตก" },
  { name: "ราชบุรี", region: "ภาคตะวันตก" },
  { name: "เพชรบุรี", region: "ภาคตะวันตก" },
  { name: "ประจวบคีรีขันธ์", region: "ภาคตะวันตก" },
  { name: "ตาก", region: "ภาคตะวันตก" },

  // ภาคใต้
  { name: "ชุมพร", region: "ภาคใต้" },
  { name: "ระนอง", region: "ภาคใต้" },
  { name: "สุราษฎร์ธานี", region: "ภาคใต้" },
  { name: "พังงา", region: "ภาคใต้" },
  { name: "ภูเก็ต", region: "ภาคใต้" },
  { name: "กระบี่", region: "ภาคใต้" },
  { name: "นครศรีธรรมราช", region: "ภาคใต้" },
  { name: "ตรัง", region: "ภาคใต้" },
  { name: "พัทลุง", region: "ภาคใต้" },
  { name: "สงขลา", region: "ภาคใต้" },
  { name: "สตูล", region: "ภาคใต้" },
  { name: "ปัตตานี", region: "ภาคใต้" },
  { name: "ยะลา", region: "ภาคใต้" },
  { name: "นราธิวาส", region: "ภาคใต้" },
] as const;

export const REGION_BY_PROVINCE = new Map<string, ThaiRegionName>(
  THAI_PROVINCES.map((province) => [province.name, province.region]),
);
