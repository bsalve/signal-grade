export default defineEventHandler(async (event) => {
  // Stripe webhook handles the actual plan upgrade asynchronously.
  // Redirect to account page — plan will be active within seconds.
  return sendRedirect(event, '/account?upgraded=1')
})
