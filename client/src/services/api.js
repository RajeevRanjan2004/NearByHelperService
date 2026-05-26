import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 10000,
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export async function registerUser(payload) {
  const response = await api.post("/auth/register", payload);
  return response.data.data;
}

export async function loginUser(payload) {
  const response = await api.post("/auth/login", payload);
  return response.data.data;
}

export async function fetchCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data.data;
}

export async function updateCurrentUserProfile(payload) {
  const response = await api.patch("/auth/profile", payload);
  return response.data.data;
}

export async function forgotPassword(payload) {
  const response = await api.post("/auth/forgot-password", payload);
  return response.data.data;
}

export async function resetPassword(payload) {
  const response = await api.post("/auth/reset-password", payload);
  return response.data.data;
}

export async function requestDeleteAccountOtp(payload) {
  const response = await api.post("/auth/request-delete-otp", payload);
  return response.data.data;
}

export async function deleteAccount(payload) {
  const response = await api.delete("/auth/account", {
    data: payload,
  });
  return response.data.data;
}

export async function fetchCategories() {
  const response = await api.get("/categories");
  return response.data.data;
}

export async function fetchHelpers(filters = {}) {
  const params =
    typeof filters === "string"
      ? filters && filters !== "all"
        ? { category: filters }
        : {}
      : Object.fromEntries(
          Object.entries({
            category: filters.category && filters.category !== "all" ? filters.category : "",
            area: filters.area || "",
            postalCode: filters.postalCode || "",
            search: filters.search || "",
            sortBy: filters.sortBy || "",
          }).filter(([, value]) => value)
        );

  const response = await api.get("/helpers", {
    params,
  });
  return response.data.data;
}

export async function fetchHelperById(helperId) {
  const response = await api.get(`/helpers/${helperId}`);
  return response.data.data;
}

export async function fetchCurrentHelperProfile() {
  const response = await api.get("/helpers/profile/me");
  return response.data.data;
}

export async function createHelperProfile(payload) {
  const response = await api.post("/helpers/profile", payload);
  return response.data.data;
}

export async function createBooking(payload) {
  const response = await api.post("/bookings", payload);
  return response.data.data;
}

export async function submitBookingReview(bookingId, payload) {
  const response = await api.post(`/bookings/${bookingId}/review`, payload);
  return response.data.data;
}

export async function createBookingPaymentOrder(bookingId) {
  const response = await api.post(`/bookings/${bookingId}/payment-order`);
  return response.data.data;
}

export async function verifyBookingPayment(bookingId, payload) {
  const response = await api.post(`/bookings/${bookingId}/verify-payment`, payload);
  return response.data.data;
}

export async function syncBookingPayment(bookingId, payload = {}) {
  const response = await api.post(`/bookings/${bookingId}/sync-payment`, payload);
  return response.data.data;
}

export async function fetchBookings() {
  const response = await api.get("/bookings/my");
  return response.data.data;
}

export async function fetchBookingById(bookingId) {
  const response = await api.get(`/bookings/${bookingId}`);
  return response.data.data;
}

export async function fetchBookingMessages(bookingId) {
  const response = await api.get(`/bookings/${bookingId}/messages`);
  return response.data.data;
}

export async function sendBookingMessage(bookingId, payload) {
  const response = await api.post(`/bookings/${bookingId}/messages`, payload);
  return response.data.data;
}

export async function rescheduleBooking(bookingId, payload) {
  const response = await api.patch(`/bookings/${bookingId}/reschedule`, payload);
  return response.data.data;
}

export async function cancelBooking(bookingId, payload = {}) {
  const response = await api.patch(`/bookings/${bookingId}/cancel`, payload);
  return response.data.data;
}

export async function createComplaint(payload) {
  const response = await api.post("/complaints", payload);
  return response.data.data;
}

export async function fetchMyComplaints() {
  const response = await api.get("/complaints/my");
  return response.data.data;
}

export async function fetchHelperBookings() {
  const response = await api.get("/bookings/helper");
  return response.data.data;
}

export async function updateBookingStatus(bookingId, payload) {
  const body =
    typeof payload === "string"
      ? { status: payload }
      : {
          status: payload?.status,
          reason: payload?.reason || "",
        };

  const response = await api.patch(`/bookings/${bookingId}/status`, body);
  return response.data.data;
}

export async function fetchAdminOverview() {
  const response = await api.get("/admin/overview");
  return response.data.data;
}

export async function fetchPendingVerificationHelpers() {
  const response = await api.get("/admin/helpers/pending-verification");
  return response.data.data;
}

export async function fetchAdminComplaints() {
  const response = await api.get("/admin/complaints");
  return response.data.data;
}

export async function updateHelperVerification(helperId, status) {
  const response = await api.patch(`/admin/helpers/${helperId}/verification`, { status });
  return response.data.data;
}

export async function issueAdminRefund(bookingId, payload) {
  const response = await api.post(`/admin/bookings/${bookingId}/refund`, payload);
  return response.data.data;
}

export async function updateComplaintStatus(complaintId, status) {
  const response = await api.patch(`/admin/complaints/${complaintId}/status`, { status });
  return response.data.data;
}

export default api;

