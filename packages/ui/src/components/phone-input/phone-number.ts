import { AsYouType, getCountries, getCountryCallingCode, parseIncompletePhoneNumber, parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js/max';

const GEOGRAPHIC_CALLING_CODES = new Set(getCountries().map((country) => getCountryCallingCode(country)));

export type PhoneCountryCode = CountryCode;
export interface PhoneInputDetails {
  country: PhoneCountryCode | null;
  formatted: string;
  status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  valid: boolean;
}

export function describePhone(value: string, country: PhoneCountryCode | null): PhoneInputDetails {
  const formatter = new AsYouType();
  const international = formatter.input(value);
  const number = parsePhoneNumberFromString(value);
  const callingCode = country ? getCountryCallingCode(country) : undefined;
  const mismatch = !!value && !!country && ((formatter.getCallingCode() && formatter.getCallingCode() !== callingCode) || (number?.country && number.country !== country));
  const national = !!country && !mismatch && formatter.getCallingCode() === callingCode;
  const nationalChars = national ? formatter.getChars().slice(1 + callingCode!.length) : '';
  const formatted = national && nationalChars
    ? new AsYouType(country).input(number?.isValid() ? number.formatNational() : nationalChars)
    : international;
  const valid = !mismatch && !!number?.country && number.isValid();
  const lengthError = value ? validatePhoneNumberLength(value) : undefined;
  const invalid = mismatch || lengthError === 'TOO_LONG' || lengthError === 'INVALID_LENGTH' || (lengthError === undefined && !valid);
  return { country, formatted, valid, status: !value ? 'empty' : valid ? 'valid' : invalid ? 'invalid' : 'incomplete' };
}

export function editPhone(text: string, country: PhoneCountryCode | null) {
  if (!text.trim()) return { value: '', country, international: false };
  // parseIncompletePhoneNumber deliberately drops punctuation; reject unsupported content first.
  if ([...text].some((character) => !/[\s()+.\-]/.test(character) && !parseIncompletePhoneNumber(character)) || (text.includes('+') && !text.trimStart().startsWith('+')) || (text.match(/\+/g)?.length ?? 0) > 1) return null;
  const international = text.trimStart().startsWith('+');
  if (!international && !country) return null;
  const formatter = new AsYouType(international ? undefined : country ?? undefined);
  formatter.input(text);
  const callingCode = formatter.getCallingCode();
  if (international && callingCode && !GEOGRAPHIC_CALLING_CODES.has(callingCode)) return null;
  const value = formatter.isValid() ? formatter.getNumberValue()! : international ? parseIncompletePhoneNumber(text) : `+${getCountryCallingCode(country!)}${parseIncompletePhoneNumber(text)}`;
  return { value: String(value), country: international ? formatter.getCountry() ?? null : country, international };
}

export function digitCaret(text: string, count: number) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text[index]!) && ++seen === count) return index + 1;
  }
  return text.length;
}

function phoneDigits(text: string) { return parseIncompletePhoneNumber(text).replace('+', ''); }
export function countDigits(text: string) { return phoneDigits(text).length; }

export function mapPhoneCaret(sourceText: string, targetText: string, position: number) {
  const source = phoneDigits(sourceText);
  const target = phoneDigits(targetText);
  let prefix = 0;
  while (prefix < source.length && prefix < target.length && source[prefix] === target[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < source.length - prefix && suffix < target.length - prefix && source[source.length - suffix - 1] === target[target.length - suffix - 1]) suffix += 1;
  const mapped = position <= prefix ? position
    : position >= source.length - suffix ? target.length - (source.length - position)
    : prefix + Math.min(position - prefix, target.length - prefix - suffix);
  return digitCaret(targetText, mapped);
}

export function nationalPhoneDigits(value: string) {
  const formatter = new AsYouType();
  formatter.input(value);
  const code = formatter.getCallingCode();
  return code ? formatter.getChars().slice(1 + code.length) : '';
}
