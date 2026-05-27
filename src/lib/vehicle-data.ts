
export const vehicleTypes = [
  { value: 'four-wheel', label: 'รถ 4 ล้อ สำหรับงานขนส่ง' },
  { value: 'two-wheel', label: 'รถ 2 ล้อ สำหรับงานขนส่ง' },
] as const;

export type VehicleType = (typeof vehicleTypes)[number]['value'];

export type VehicleBrandOption = {
  value: string;
  label: string;
  models: { value: string; label: string }[];
};

export const vehicleCatalog: Record<VehicleType, VehicleBrandOption[]> = {
  'four-wheel': [
    {
      value: 'Isuzu',
      label: 'Isuzu',
      models: [
        { value: 'D-Max', label: 'D-Max' },
        { value: 'MU-X', label: 'MU-X' },
        { value: 'Elf (N-Series)', label: 'Elf (N-Series)' },
        { value: 'Forward (F-Series)', label: 'Forward (F-Series)' },
        { value: 'Giga', label: 'Giga' },
        { value: 'Traviz', label: 'Traviz' },
      ],
    },
    {
      value: 'Toyota',
      label: 'Toyota',
      models: [
        { value: 'Hilux Vigo', label: 'Hilux Vigo' },
        { value: 'Hilux Revo', label: 'Hilux Revo' },
        { value: 'Fortuner', label: 'Fortuner' },
        { value: 'Hiace', label: 'Hiace' },
        { value: 'Commuter', label: 'Commuter' },
        { value: 'Coaster', label: 'Coaster' },
        { value: 'Innova Crysta', label: 'Innova Crysta' },
      ],
    },
    {
      value: 'Mitsubishi',
      label: 'Mitsubishi',
      models: [
        { value: 'Triton', label: 'Triton' },
        { value: 'Pajero Sport', label: 'Pajero Sport' },
        { value: 'Canter (Fuso)', label: 'Canter (Fuso)' },
      ],
    },
    {
      value: 'Ford',
      label: 'Ford',
      models: [
        { value: 'Ranger', label: 'Ranger' },
        { value: 'Everest', label: 'Everest' },
        { value: 'Transit', label: 'Transit' },
      ],
    },
    {
      value: 'Nissan',
      label: 'Nissan',
      models: [
        { value: 'Navara', label: 'Navara' },
        { value: 'Urvan', label: 'Urvan' },
        { value: 'Terra', label: 'Terra' },
      ],
    },
    {
      value: 'Hino',
      label: 'Hino',
      models: [
        { value: '300 Series', label: '300 Series' },
        { value: '500 Series', label: '500 Series' },
        { value: '700 Series', label: '700 Series' },
      ],
    },
    {
      value: 'Mitsubishi Fuso',
      label: 'Mitsubishi Fuso',
      models: [
        { value: 'Canter', label: 'Canter' },
        { value: 'Fighter', label: 'Fighter' },
      ],
    },
    {
      value: 'Hyundai',
      label: 'Hyundai',
      models: [
        { value: 'H-1', label: 'H-1' },
        { value: 'Staria Load', label: 'Staria Load' },
      ],
    },
    {
      value: 'TATA',
      label: 'TATA Motors',
      models: [
        { value: 'Super Ace Mint', label: 'Super Ace Mint' },
        { value: 'Xenon', label: 'Xenon' },
      ],
    },
    {
      value: 'Mercedes-Benz',
      label: 'Mercedes-Benz',
      models: [
        { value: 'Sprinter', label: 'Sprinter' },
        { value: 'Vito', label: 'Vito' },
      ],
    },
    {
      value: 'MG',
      label: 'MG',
      models: [
        { value: 'Extender', label: 'Extender' },
        { value: 'V80', label: 'V80' },
      ],
    },
    {
      value: 'BYD',
      label: 'BYD',
      models: [
        { value: 'T3', label: 'T3' },
        { value: 'ETM6', label: 'ETM6' },
      ],
    },
    {
      value: 'other',
      label: 'อื่นๆ',
      models: [],
    },
  ],
  'two-wheel': [
    {
      value: 'Honda',
      label: 'Honda',
      models: [
        { value: 'Wave 110i', label: 'Wave 110i' },
        { value: 'Click 125i', label: 'Click 125i' },
        { value: 'PCX 160', label: 'PCX 160' },
        { value: 'Super Cub 110', label: 'Super Cub 110' },
        { value: 'Winner X', label: 'Winner X' },
      ],
    },
    {
      value: 'Yamaha',
      label: 'Yamaha',
      models: [
        { value: 'Finn', label: 'Finn' },
        { value: 'GT125', label: 'GT125' },
        { value: 'NMAX Connected', label: 'NMAX Connected' },
        { value: 'Aerox 155', label: 'Aerox 155' },
        { value: 'Grand Filano Hybrid', label: 'Grand Filano Hybrid' },
      ],
    },
    {
      value: 'Suzuki',
      label: 'Suzuki',
      models: [
        { value: 'Raider R150 Fi', label: 'Raider R150 Fi' },
        { value: 'Smash 115 Fi', label: 'Smash 115 Fi' },
        { value: 'Address 110', label: 'Address 110' },
      ],
    },
    {
      value: 'Kawasaki',
      label: 'Kawasaki',
      models: [
        { value: 'W175', label: 'W175' },
        { value: 'KLX 150', label: 'KLX 150' },
      ],
    },
    {
      value: 'GPX',
      label: 'GPX',
      models: [
        { value: 'Drone 150', label: 'Drone 150' },
        { value: 'Legend 150 Fi', label: 'Legend 150 Fi' },
      ],
    },
    {
      value: 'Vespa',
      label: 'Vespa',
      models: [
        { value: 'Primavera 125', label: 'Primavera 125' },
        { value: 'Sprint 150', label: 'Sprint 150' },
      ],
    },
    {
      value: 'other',
      label: 'อื่นๆ',
      models: [],
    },
  ],
};

export const getVehicleBrands = (type?: VehicleType) => {
  if (!type) return [];
  return vehicleCatalog[type];
};

export const getVehicleModels = (type: VehicleType | undefined, brand: string | undefined) => {
  if (!type || !brand) return [];
  const brandEntry = vehicleCatalog[type]?.find((b) => b.value === brand);
  return brandEntry?.models ?? [];
};

export const carColors = [
    "ขาว",
    "ดำ",
    "เทา",
    "เงิน (บรอนซ์)",
    "แดง",
    "น้ำเงิน",
    "น้ำตาล",
    "เขียว",
    "เหลือง",
    "ส้ม",
    "ชมพู",
    "ม่วง",
    "ทอง",
];
