let checkoutLoader = null;

function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Checkout can only be opened in the browser"));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (checkoutLoader) {
    return checkoutLoader;
  }

  checkoutLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded"));
    document.body.appendChild(script);
  });

  return checkoutLoader;
}

async function openRazorpayCheckout({
  booking,
  checkoutOrder,
  customer,
  onDismiss,
  onFailure,
  onSuccess,
}) {
  const Razorpay = await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    let finished = false;

    function settle(callback, value) {
      if (finished) {
        return;
      }

      finished = true;

      Promise.resolve(callback ? callback(value) : value)
        .then(resolve)
        .catch(reject);
    }

    const options = {
      key: checkoutOrder.keyId,
      amount: checkoutOrder.amount,
      currency: checkoutOrder.currency,
      name: checkoutOrder.merchantName,
      description: `Booking for ${booking.helperName || "helper service"}`,
      order_id: checkoutOrder.orderId,
      prefill: {
        name: customer?.fullName || "",
        email: customer?.email || "",
        contact: customer?.phone || "",
      },
      notes: {
        bookingId: booking.id,
        helperId: booking.helperId || "",
      },
      theme: {
        color: "#c75b39",
      },
      modal: {
        confirm_close: true,
        ondismiss: () => settle(onDismiss, null),
      },
      handler: (response) => settle(onSuccess, response),
    };

    const instance = new Razorpay(options);

    instance.on("payment.failed", (response) => {
      settle(onFailure, response.error || response);
    });

    instance.open();
  });
}

export { loadRazorpayCheckout, openRazorpayCheckout };
