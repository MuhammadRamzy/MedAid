import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      type,
      beneficiaryName,
      beneficiaryPhone,
      itemName,
      assetTag,
      expectedReturnAt,
      conditionOnCheckIn,
      volunteerInCharge,
    } = body;

    if (!beneficiaryPhone) {
      return NextResponse.json({ error: "Missing phone number" }, { status: 400 });
    }

    const formattedDate = expectedReturnAt
      ? new Date(expectedReturnAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

    let messageEnglish = "";
    let messageMalayalam = "";

    switch (type) {
      case "ALLOCATION_SUCCESS":
        messageEnglish = `Dear ${beneficiaryName}, ${itemName} (Asset: ${assetTag}) has been successfully allocated to you. Expected return date is ${formattedDate}. Please return it on time. Thank you. - KMCC Charity`;
        messageMalayalam = `Dear ${beneficiaryName}, KMCC-yil ninnu ningalkku ${itemName} (Asset: ${assetTag}) nalkiyirikkunnu. Thirichu tharendathu: ${formattedDate}. Dayavayi samayathu thirichethikkuka. Nanni. - KMCC Charity (Volunteer: ${volunteerInCharge})`;
        break;

      case "RETURN_REMINDER":
        messageEnglish = `Reminder: The medical equipment ${itemName} (Asset: ${assetTag}) allocated to ${beneficiaryName} is due for return on ${formattedDate}. Please arrange for its return. Contact Volunteer: ${volunteerInCharge}. - KMCC Charity`;
        messageMalayalam = `Ormapetteduthal: KMCC-yil ninnu vangiye ${itemName} (Asset: ${assetTag}) thirichu tharendathu ${formattedDate} thiyathiyanu. Dayavayi thirichethikkan sradhikkuka. Contact: ${volunteerInCharge}. - KMCC Charity`;
        break;

      case "RETURN_CONFIRMATION":
        messageEnglish = `Dear ${beneficiaryName}, we have received the medical equipment ${itemName} (Asset: ${assetTag}) back in [${conditionOnCheckIn}] condition. Thank you for returning it. - KMCC Charity`;
        messageMalayalam = `Dear ${beneficiaryName}, ningal vangiye ${itemName} (Asset: ${assetTag}) thirichu labhichittundu. Condition: [${conditionOnCheckIn}]. Sahakaranathinu nanni! - KMCC Charity (Volunteer: ${volunteerInCharge})`;
        break;

      default:
        return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    // Print to logs to simulate sending via Twilio/Baileys
    console.log("=========================================");
    console.log(`[WHATSAPP AUTOMATION LOG] Sending to: ${beneficiaryPhone}`);
    console.log(`[TYPE] ${type}`);
    console.log(`[ENGLISH] ${messageEnglish}`);
    console.log(`[MALAYALAM (MANGLISH)] ${messageMalayalam}`);
    console.log("=========================================");

    return NextResponse.json({
      success: true,
      logPrinted: true,
      recipient: beneficiaryPhone,
      messages: {
        english: messageEnglish,
        malayalam: messageMalayalam,
      },
    });
  } catch (error) {
    console.error("WhatsApp API notification dispatch failed:", error);
    return NextResponse.json(
      { error: "Failed to dispatch notification log" },
      { status: 500 }
    );
  }
}
