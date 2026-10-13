// Input contracts retained from trucoshi-client-private, 0e7991ce09be3ea26a6db16b59030ffb84fd4709.
// Seat-position/frame parity was deliberately removed: the measured curve owns geometry now.
export const BREAKPOINT_CASES = [
  [430,878,'phoneTall'],[430,876,'phoneCompact'],[431,876,'phoneTall'],
  [599,521,'phoneTall'],[600,521,'tablet'],[600,520,'tablet'],[754,520,'phoneWide'],
  [899,900,'tablet'],[900,900,'tabletWide'],[1199,900,'desktop'],[1200,1000,'desktop'],
  [900,721,'tabletWide'],[900,720,'desktop'],[650,501,'tabletWide'],
  [1199,1000,'tabletWide'],[500,520,'phoneWide'],[500,521,'phoneTall'],
  [412,841,'phoneTall'],[412,840,'phoneCompact'],[753,520,'tabletWide'],[754,521,'tabletWide'],
] as const;

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
