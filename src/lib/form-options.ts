import type { SearchableSelectOption } from "@/components/ui/searchable-select";

type AddressNode = {
  value: string;
  label: string;
  subDistricts: Array<{
    value: string;
    label: string;
  }>;
};

type ProvinceNode = {
  value: string;
  label: string;
  districts: AddressNode[];
};

const BASE_JOB_POSITIONS: SearchableSelectOption[] = [
  { value: "driver", label: "พนักงานขับรถ" },
];

const BASE_RACE_OPTIONS: SearchableSelectOption[] = [
  { value: "ไทย", label: "ไทย" },
  { value: "จีน", label: "จีน" },
  { value: "มลายู", label: "มลายู" },
  { value: "ลาว", label: "ลาว" },
  { value: "กะเหรี่ยง", label: "กะเหรี่ยง" },
];

const BASE_NATIONALITY_OPTIONS: SearchableSelectOption[] = [
  { value: "ไทย", label: "ไทย" },
  { value: "พม่า", label: "พม่า" },
  { value: "ลาว", label: "ลาว" },
  { value: "กัมพูชา", label: "กัมพูชา" },
  { value: "เวียดนาม", label: "เวียดนาม" },
];

const BASE_RELIGION_OPTIONS: SearchableSelectOption[] = [
  { value: "พุทธ", label: "ศาสนาพุทธ" },
  { value: "คริสต์", label: "ศาสนาคริสต์" },
  { value: "อิสลาม", label: "ศาสนาอิสลาม" },
  { value: "ฮินดู", label: "ศาสนาฮินดู" },
  { value: "ซิกข์", label: "ศาสนาซิกข์" },
];

// Full Thailand administrative data: 83 provinces, 936 districts, 7,475 sub-districts
// Source: https://github.com/earthchie/jquery.Thailand.js
import thaiProvincesData from "@/lib/thai-provinces.json";

const THAI_PROVINCES: ProvinceNode[] = thaiProvincesData as ProvinceNode[];

const OTHER_OPTION: SearchableSelectOption = {
  value: "__other__",
  label: "อื่นๆ",
};

export const jobPositionOptions = BASE_JOB_POSITIONS;

export const raceOptions = [...BASE_RACE_OPTIONS];

export const nationalityOptions = [...BASE_NATIONALITY_OPTIONS];

export const religionOptions = [...BASE_RELIGION_OPTIONS];

export const provinceOptions: SearchableSelectOption[] = [
  ...THAI_PROVINCES.map((province) => ({
    value: province.value,
    label: province.label,
  })),
];

export const otherOption = OTHER_OPTION;

export function withOtherOption(
  options: SearchableSelectOption[],
  currentValue?: string | null
): SearchableSelectOption[] {
  const enriched = [...options];
  if (currentValue && currentValue !== OTHER_OPTION.value) {
    const exists = enriched.some((option) => option.value === currentValue);
    if (!exists) {
      enriched.push({
        value: currentValue,
        label: currentValue,
      });
    }
  }
  enriched.push(OTHER_OPTION);
  return enriched;
}

export function getDistrictOptions(
  provinceValue?: string
): SearchableSelectOption[] {
  if (!provinceValue) return [];
  const province =
    THAI_PROVINCES.find((item) => item.value === provinceValue) ??
    THAI_PROVINCES.find((item) => item.label === provinceValue);
  if (!province) return [];
  return province.districts.map((district) => ({
    value: district.value,
    label: district.label,
  }));
}

export function getSubDistrictOptions(
  provinceValue?: string,
  districtValue?: string
): SearchableSelectOption[] {
  if (!provinceValue || !districtValue) return [];
  const province =
    THAI_PROVINCES.find((item) => item.value === provinceValue) ??
    THAI_PROVINCES.find((item) => item.label === provinceValue);
  if (!province) return [];
  const district =
    province.districts.find((item) => item.value === districtValue) ??
    province.districts.find((item) => item.label === districtValue);
  if (!district) return [];
  return district.subDistricts.map((subDistrict) => ({
    value: subDistrict.value,
    label: subDistrict.label,
  }));
}

