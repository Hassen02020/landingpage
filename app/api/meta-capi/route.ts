import { NextRequest, NextResponse } from "next/server"

const PIXEL_ID = process.env.META_PIXEL_ID || "1674012850599992"
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN

// SHA-256 hashing function for user data
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventName, customData, eventId, userData = {} } = body

    if (!eventName) {
      return NextResponse.json({ error: "eventName is required" }, { status: 400 })
    }

    // Extract user data from headers for matching
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                     request.headers.get("x-real-ip") || 
                     "127.0.0.1"
    const userAgent = request.headers.get("user-agent") || ""

    // Hash user data for privacy and matching
    const hashedIp = await sha256(ipAddress)
    const hashedUserAgent = await sha256(userAgent)

    // Prepare user data for CAPI
    const apiUserData = {
      ...userData,
      client_ip_address: ipAddress,
      client_user_agent: userAgent,
      external_id: hashedIp, // Use hashed IP as external ID for matching
    }

    // Prepare the event data
    const eventData = {
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: apiUserData,
      custom_data: customData,
    }

    // Send to Meta Conversions API
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [eventData],
          access_token: ACCESS_TOKEN,
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.error("Meta CAPI Error:", result)
      return NextResponse.json(
        { error: "Failed to send event to Meta CAPI", details: result },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Meta CAPI Route Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
