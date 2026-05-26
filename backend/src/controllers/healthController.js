function getHealth(_request, response) {
  response.json({
    success: true,
    message: "Server is running",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
}

export { getHealth };
