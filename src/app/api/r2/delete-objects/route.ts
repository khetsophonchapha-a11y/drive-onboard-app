
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { r2 } from "../_client";
import { assertAdmin } from "../_auth";

const Body = z.object({
  r2Keys: z.array(z.string().min(1)).min(1, "r2Keys array cannot be empty"),
});

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req); // Ensure only admins can delete

    const bucket = process.env.R2_BUCKET;
    if (!bucket) {
      throw new Error("R2_BUCKET environment variable is not set");
    }

    const { r2Keys } = Body.parse(await req.json());

    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: r2Keys.map((key) => ({ Key: key })),
        Quiet: false, // Set to false to get reports on successes and errors
      },
    });

    const result = await r2.send(command);

    if (result.Errors && result.Errors.length > 0) {
      console.error("Errors deleting some objects from R2:", result.Errors);
      // Even with some errors, we might have successfully deleted others.
      // We'll return a partial success response.
      return NextResponse.json(
        {
          message: `Successfully deleted ${result.Deleted?.length || 0} objects, but failed to delete ${result.Errors.length} objects.`,
          deleted: result.Deleted?.map(d => d.Key),
          errors: result.Errors.map(e => ({ key: e.Key, message: e.Message })),
        },
        { status: 207 } // 207 Multi-Status
      );
    }
    
    return NextResponse.json({
        message: "All specified objects deleted successfully.",
        deleted: result.Deleted?.map(d => d.Key)
    });

  } catch (error: any) {
    console.error("[R2 DeleteObjects Error]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `Could not delete objects. Reason: ${errorMessage}` },
      { status: 500 }
    );
  }
}

    