export const JORDAN_GOVERNORATES = [
  { id: 'amman', name: 'عمان' },
  { id: 'irbid', name: 'إربد' },
  { id: 'zarqa', name: 'الزرقاء' },
  { id: 'mafraq', name: 'المفرق' },
  { id: 'jerash', name: 'جرش' },
  { id: 'ajloun', name: 'عجلون' },
  { id: 'balqa', name: 'البلقاء' },
  { id: 'madaba', name: 'مأدبا' },
  { id: 'karak', name: 'الكرك' },
  { id: 'tafilah', name: 'الطفيلة' },
  { id: 'maan', name: 'معان' },
  { id: 'aqaba', name: 'العقبة' },
];

export const VEHICLE_TYPES = [
  { id: 'sedan', name: 'سيدان' },
  { id: 'suv', name: 'SUV' },
  { id: 'minibus', name: 'باص صغير' },
  { id: 'other', name: 'غير ذلك' },
];

export const SEAT_CONFIG = {
  driver: { id: 'driver', name: 'السائق', icon: 'User', available: false },
  front_passenger: { id: 'front_passenger', name: 'المقعد الأمامي', icon: 'Armchair', available: true },
  back_right: { id: 'back_right', name: 'المقعد الخلفي الأيمن', icon: 'Armchair', available: true },
  back_middle: { id: 'back_middle', name: 'المقعد الخلفي الأوسط', icon: 'Armchair', available: true },
  back_left: { id: 'back_left', name: 'المقعد الخلفي الأيسر', icon: 'Armchair', available: true },
};

export type SeatID = keyof typeof SEAT_CONFIG;
