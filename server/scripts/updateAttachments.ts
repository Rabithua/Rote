/**
 * Update attachments with compressUrl
 */

import axios from "axios";
import prisma from "../utils/prisma";

async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function generateCompressUrl(originalUrl: string): string {
  const parsedUrl = new URL(originalUrl);
  const pathParts = parsedUrl.pathname.split("/");

  const compressedIndex = pathParts.indexOf("uploads");
  if (compressedIndex !== -1) {
    pathParts[compressedIndex] = "compressed";
  }

  const filename = pathParts[pathParts.length - 1];
  const nameWithoutExt = filename.split(".").slice(0, -1).join(".");
  pathParts[pathParts.length - 1] = `${nameWithoutExt}.webp`;

  parsedUrl.pathname = pathParts.join("/");
  return parsedUrl.toString();
}

async function updateAttachments() {
  try {
    const attachments = await prisma.attachment.findMany({
      select: {
        id: true,
        url: true,
        compressUrl: true,
      },
    });

    let totalAttachments = attachments.length;
    let processedAttachments = 0;
    let skippedAttachments = 0;
    let updatedAttachments = 0;

    for (const attachment of attachments) {
      if (!attachment.url) {
        console.log(`Skipping attachment without URL: ${attachment.id}`);
        skippedAttachments++;
        continue;
      }

      if (attachment.compressUrl) {
        console.log(
          `Skipping attachment with existing compressUrl: ${attachment.id}`
        );
        processedAttachments++;
        continue;
      }

      const compressUrl = generateCompressUrl(attachment.url);

      if (await isUrlAccessible(compressUrl)) {
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { compressUrl },
        });
        console.log(
          `Updated attachment ${attachment.id} with compressUrl: ${compressUrl}`
        );
        updatedAttachments++;
      } else {
        console.log(
          `CompressUrl not accessible for attachment ${attachment.id}: ${compressUrl}`
        );
        skippedAttachments++;
      }

      processedAttachments++;
    }

    const coverageRate =
      ((processedAttachments - skippedAttachments) / totalAttachments) * 100;

    console.log("All attachments processed");
    console.log(`Total attachments: ${totalAttachments}`);
    console.log(`Processed attachments: ${processedAttachments}`);
    console.log(`Updated attachments: ${updatedAttachments}`);
    console.log(`Skipped attachments: ${skippedAttachments}`);
    console.log(`CompressUrl coverage rate: ${coverageRate.toFixed(2)}%`);
  } catch (error) {
    console.error("Error updating attachments:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAttachments();
