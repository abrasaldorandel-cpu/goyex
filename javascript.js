const ROOM_RATES = {
  standard: 110,
  deluxe: 150,
  twin: 125,
  executive: 240,
  family: 195,
};

const TAX_RATE = 0.12;
const EXTRA_BED_PER_NIGHT = 25;
const AIRPORT_SHUTTLE_FLAT = 35;
const STORAGE_KEY = "hotel_reservation_draft_v1";

const form = document.getElementById("reservation-form");
const checkinInput = document.getElementById("checkin-date");
const checkoutInput = document.getElementById("checkout-date");
const roomTypeSelect = document.getElementById("room-type");
const roomCountInput = document.getElementById("room-count");
const dateErrorEl = document.getElementById("date-error");
const bannerEl = document.getElementById("confirmation-banner");

const quoteNightsEl = document.getElementById("quote-nights");
const quoteSubtotalEl = document.getElementById("quote-subtotal");
const quoteAddonsEl = document.getElementById("quote-addons");
const quoteTaxEl = document.getElementById("quote-tax");
const quoteTotalEl = document.getElementById("quote-total");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function toISODate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initDateBounds() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minCheckin = toISODate(today);
  checkinInput.min = minCheckin;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  checkoutInput.min = toISODate(tomorrow);
}

function calculateNights() {
  dateErrorEl.hidden = true;
  dateErrorEl.textContent = "";

  if (!checkinInput.value || !checkoutInput.value) {
    return 0;
  }

  const start = new Date(`${checkinInput.value}T00:00:00`);
  const end = new Date(`${checkoutInput.value}T00:00:00`);

  const minNextDay = new Date(start);
  minNextDay.setDate(minNextDay.getDate() + 1);
  checkoutInput.min = toISODate(minNextDay);

  const diffMs = end - start;
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    dateErrorEl.textContent = "Check-out date must be at least one day after check-in.";
    dateErrorEl.hidden = false;
    return 0;
  }

  return nights;
}

function updateQuote() {
  const nights = calculateNights();
  const rate = ROOM_RATES[roomTypeSelect.value] || 0;
  const rooms = Math.max(1, parseInt(roomCountInput.value, 10) || 1);

  const selectedPrefs = Array.from(
    form.querySelectorAll('input[name="preferences"]:checked')
  ).map((el) => el.value);

  const subtotal = nights * rate * rooms;

  let addons = 0;
  if (nights > 0 && selectedPrefs.includes("extra_bed_crib")) {
    addons += EXTRA_BED_PER_NIGHT * nights * rooms;
  }
  if (selectedPrefs.includes("airport_shuttle")) {
    addons += AIRPORT_SHUTTLE_FLAT;
  }

  const taxableAmount = subtotal + addons;
  const tax = taxableAmount * TAX_RATE;
  const total = taxableAmount + tax;

  quoteNightsEl.textContent = `${nights} ${nights === 1 ? "night" : "nights"}`;
  quoteSubtotalEl.textContent = formatCurrency(subtotal);
  quoteAddonsEl.textContent = formatCurrency(addons);
  quoteTaxEl.textContent = formatCurrency(tax);
  quoteTotalEl.textContent = formatCurrency(total);

  return { nights, subtotal, addons, tax, total };
}

function saveDraft() {
  const data = {};
  const elements = form.querySelectorAll("input, select, textarea");

  elements.forEach((el) => {
    if (!el.name || el.name === "card_number" || el.name === "cvv") return;

    if (el.type === "checkbox") {
      if (el.name === "preferences") {
        data.preferences = Array.from(
          form.querySelectorAll('input[name="preferences"]:checked')
        ).map((cb) => cb.value);
      } else {
        data[el.name] = el.checked;
      }
    } else if (el.type === "radio") {
      if (el.checked) {
        data[el.name] = el.value;
      }
    } else {
      data[el.name] = el.value;
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([key, val]) => {
      if (key === "preferences" && Array.isArray(val)) {
        form.querySelectorAll('input[name="preferences"]').forEach((cb) => {
          cb.checked = val.includes(cb.value);
        });
        return;
      }

      const field = form.elements[key];
      if (!field) return;

      if (field instanceof RadioNodeList) {
        Array.from(field).forEach((radio) => {
          radio.checked = radio.value === val;
        });
      } else if (field.type === "checkbox") {
        field.checked = Boolean(val);
      } else {
        field.value = val;
      }
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function generateBookingCode() {
  const now = new Date();
  const datePart = toISODate(now).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `HTL-${datePart}-${randomPart}`;
}

form.addEventListener("input", () => {
  updateQuote();
  saveDraft();
});

form.addEventListener("change", () => {
  updateQuote();
  saveDraft();
});

form.addEventListener("reset", () => {
  localStorage.removeItem(STORAGE_KEY);
  bannerEl.hidden = true;
  setTimeout(() => {
    initDateBounds();
    updateQuote();
  }, 0);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const quote = updateQuote();

  if (!form.checkValidity() || quote.nights <= 0) {
    form.reportValidity();
    if (quote.nights <= 0) {
      dateErrorEl.textContent = "Please select valid check-in and check-out dates before submitting.";
      dateErrorEl.hidden = false;
    }
    return;
  }

  const guestName = document.getElementById("full-name").value.trim();
  const bookingCode = generateBookingCode();

  bannerEl.innerHTML = `
    <strong>Reservation Request Prepared — Ref: ${bookingCode}</strong>
    Thank you, ${guestName}. Your ${quote.nights}-night stay estimate is ${formatCurrency(quote.total)} (including 12% taxes &amp; fees).
  `;
  bannerEl.hidden = false;
  bannerEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  localStorage.removeItem(STORAGE_KEY);
});

initDateBounds();
loadDraft();
updateQuote();