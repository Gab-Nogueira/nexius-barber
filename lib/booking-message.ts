import type { BookingRecord } from './nexius';
import { demoModeEnabled } from './nexius';
import { publicContent } from './content';
import { formatBookingWhatsApp } from './booking-message-format';

export async function bookingWhatsApp(booking: BookingRecord) {
  try {
    const { values } = await publicContent();
    return formatBookingWhatsApp(booking, values.whatsapp_number || '', values.business_address, demoModeEnabled());
  } catch {
    // Optional contact lookup must not turn a persisted reservation into an error.
    return null;
  }
}
