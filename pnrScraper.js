const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Fetch PNR status from RailYatri.in
 * @param {string} pnrNumber - 10-digit PNR number
 * @returns {Promise<string[]>} - List of status lines
 */
async function getPnrStatus(pnrNumber) {
    try {
        const response = await axios.get(`https://www.railyatri.in/pnr-status/${pnrNumber}`, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const statusLines = [];

        // Extract train details
        const trainNameElement = $(".pnr-search-result-info .train-info .pnr-normal-font a span[style='font-weight:600;']");
        let trainName = trainNameElement.clone().children().remove().end().text().trim(); // get "12480"
        let trainLabel = trainNameElement.find("span").text().trim(); // get "– SURYANAGARI EXP"

        if (trainName || trainLabel) {
            trainName = `${trainName} ${trainLabel}`.replace(/\s+/g, " ").trim();
            statusLines.push(`🚆 ${trainName}`);
        }

        // Extract FROM and TO station details
        const fromStation = $(".train-route .col-xs-4").eq(0).find(".pnr-bold-txt").text().trim();
        const fromTime = $(".train-route .col-xs-4").eq(0).find("p").eq(2).text().trim();

        const toStation = $(".train-route .col-xs-4").eq(1).find(".pnr-bold-txt").text().trim();
        const toTime = $(".train-route .col-xs-4").eq(1).find("p").eq(2).text().trim();

        statusLines.push(`🛫 From: ${fromStation} at ${fromTime}`);
        statusLines.push(`🛬 To: ${toStation} at ${toTime}`);

        // Extract Day of Boarding, Class, and Platform
        const dayOfBoarding = $(".boarding-detls .col-xs-4").eq(0).find(".pnr-bold-txt").text().trim();
        const travelClass = $(".boarding-detls .col-xs-4").eq(1).find(".pnr-bold-txt").text().trim();
        const platform = $(".boarding-detls .col-xs-4").eq(2).find(".pnr-bold-txt").text().trim();

        statusLines.push(`📅 Day of Boarding: ${dayOfBoarding}`);
        statusLines.push(`💺 Class: ${travelClass}`);
        statusLines.push(`🛤️ Platform (Tentative): ${platform}`);

        // Extract passenger status from #status block
        const statusBlocks = $("#status .PNR_status");

        if (statusBlocks.length > 0) {
            statusLines.push(`\n📋 Passenger Booking Details:`);

            statusBlocks.each((i, el) => {
                const bookingStatus = $(el).find(".col-xs-4").eq(0).find(".statusType").text().trim();
                const currentStatus = $(el).find(".col-xs-4").eq(1).find(".statusType").text().trim();
                const probabilityImg = $(el).find(".col-xs-4").eq(2).find("img").attr("src") || "";
                const probabilityLevel = probabilityImg.includes("HIGH")
                    ? "HIGH"
                    : probabilityImg.includes("MEDIUM")
                        ? "MEDIUM"
                        : probabilityImg.includes("LOW")
                            ? "LOW"
                            : "UNKNOWN";

                statusLines.push(`👤 Passenger ${i + 1}: ${bookingStatus} → ${currentStatus} | 🟢 Probability: ${probabilityLevel}`);
            });
        }


        if (statusLines.length === 0) {
            throw new Error("PNR status not found or invalid PNR");
        }

        return statusLines;
    } catch (error) {
        console.log(error);
        console.error("❌ Error in getPnrStatus:", error.message);
        throw error;
    }
}

module.exports = getPnrStatus;
