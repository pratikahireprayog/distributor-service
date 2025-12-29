/**
 * India Post Domestic AWB Generator
 *
 * Generates AWB numbers following India Post Domestic specifications:
 * - Format: EB{8-digit-serial}{check-digit}IN (13 characters total)
 * - Positions 1-2: "EB" (fixed prefix)
 * - Positions 3-10: 8-digit serial number (randomly generated in range 21433001-21434000)
 * - Position 11: Check digit (calculated using weighted modules 11)
 * - Positions 12-13: "IN" (country code, fixed)
 *
 * Check digit calculation:
 * - Weighting factors: 86423597 (applied left to right)
 * - Multiply each digit by corresponding weight, sum products
 * - Divide sum by 11
 * - Special cases:
 *   - Remainder = 0 → check digit = 5
 *   - Remainder = 1 → check digit = 0
 *   - Otherwise → check digit = 11 - remainder
 *   - If result = 10 → check digit = 0
 *   - If result = 11 → check digit = 5
 */

/**
 * Calculate check digit using weighted modules 11 formula
 * @param serialNumber 8-digit serial number as string
 * @returns Check digit (0-9)
 */
function calculateCheckDigit(serialNumber: string): number {
  // Weighting factors: 86423597 (applied left to right)
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];

  // Validate serial number length
  if (serialNumber.length !== 8) {
    throw new Error(
      `Serial number must be exactly 8 digits, got ${serialNumber.length}`
    );
  }

  // Multiply each digit by corresponding weight and sum
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const digit = parseInt(serialNumber[i], 10);
    if (isNaN(digit)) {
      throw new Error(`Invalid digit at position ${i}: ${serialNumber[i]}`);
    }
    sum += digit * weights[i];
  }

  // Divide by 11 and get remainder
  const remainder = sum % 11;

  // Calculate check digit based on remainder
  let checkDigit: number;

  if (remainder === 0) {
    checkDigit = 5;
  } else if (remainder === 1) {
    checkDigit = 0;
  } else {
    checkDigit = 11 - remainder;

    // Additional special cases
    if (checkDigit === 10) {
      checkDigit = 0;
    } else if (checkDigit === 11) {
      checkDigit = 5;
    }
  }

  return checkDigit;
}

/**
 * Generate a random 8-digit serial number within the specified range
 * Range: 21433001 to 21434000 (inclusive)
 * @returns 8-digit serial number as string
 */
function generateRandomSerial(): string {
  // Serial number range: 21433001 to 21434000 (inclusive)
  const MIN_SERIAL = 21433001;
  const MAX_SERIAL = 21434000;
  
  // Generate random number within the range
  // Math.random() generates [0, 1), so we multiply by (MAX - MIN + 1) to get [0, MAX - MIN + 1)
  // Then add MIN to shift to [MIN, MAX + 1), and floor to get [MIN, MAX]
  const randomNum = Math.floor(Math.random() * (MAX_SERIAL - MIN_SERIAL + 1)) + MIN_SERIAL;
  
  // Return as string (already 8 digits, no padding needed)
  return randomNum.toString();
}

/**
 * Generate India Post Domestic AWB number
 * Format: EB{8-digit-serial}{check-digit}IN
 *
 * @returns Generated AWB number (13 characters)
 */
export function generateIndiaPostDomesticAWB(): string {
  // Generate random 8-digit serial number
  const serialNumber = generateRandomSerial();

  // Calculate check digit
  const checkDigit = calculateCheckDigit(serialNumber);

  // Construct AWB: EB + 8-digit serial + check digit + IN
  const awb = `EB${serialNumber}${checkDigit}IN`;

  // Validate final length
  if (awb.length !== 13) {
    throw new Error(
      `Generated AWB has invalid length: ${awb.length}, expected 13`
    );
  }

  return awb;
}

/**
 * Validate an India Post Domestic AWB number format and check digit
 * @param awb AWB number to validate
 * @returns true if valid, false otherwise
 */
export function validateIndiaPostDomesticAWB(awb: string): boolean {
  // Check length
  if (awb.length !== 13) {
    return false;
  }

  // Check prefix
  if (awb.substring(0, 2) !== "EB") {
    return false;
  }

  // Check suffix
  if (awb.substring(11, 13) !== "IN") {
    return false;
  }

  // Extract serial number and check digit
  const serialNumber = awb.substring(2, 10);
  const providedCheckDigit = parseInt(awb[10], 10);

  // Validate serial number is numeric
  if (!/^\d{8}$/.test(serialNumber)) {
    return false;
  }

  // Calculate expected check digit
  try {
    const expectedCheckDigit = calculateCheckDigit(serialNumber);
    return providedCheckDigit === expectedCheckDigit;
  } catch (error) {
    return false;
  }
}
