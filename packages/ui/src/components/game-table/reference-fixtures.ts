// Input contracts retained from trucoshi-client-private, 0e7991ce09be3ea26a6db16b59030ffb84fd4709.
// tableSlots.ts output for prefixes of [alex, blair, you(local), drew, emery, frankie], fill=6.
export const REFERENCE_SLOT_KEYS = {
  clockwise: [
    ['slot-0','slot-1','slot-2','slot-3','slot-4','slot-5'],
    ['alex','slot-1','slot-2','slot-3','slot-4','slot-5'],
    ['alex','blair','slot-2','slot-3','slot-4','slot-5'],
    ['you','slot-3','slot-4','slot-5','alex','blair'],
    ['you','drew','slot-4','slot-5','alex','blair'],
    ['you','drew','emery','slot-5','alex','blair'],
    ['you','drew','emery','frankie','alex','blair'],
  ],
  counterclockwise: [
    ['slot-0','slot-5','slot-4','slot-3','slot-2','slot-1'],
    ['alex','slot-5','slot-4','slot-3','slot-2','slot-1'],
    ['alex','slot-5','slot-4','slot-3','slot-2','blair'],
    ['you','blair','alex','slot-5','slot-4','slot-3'],
    ['you','blair','alex','slot-5','slot-4','drew'],
    ['you','blair','alex','slot-5','emery','drew'],
    ['you','blair','alex','frankie','emery','drew'],
  ],
} as const;
