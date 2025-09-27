
import { NextResponse } from 'next/server';
import type { Application } from '@/lib/types';

// This is a mock database. In a real application, you would use a real database
// like Firestore, PostgreSQL, etc.
const mockDb: Application[] = [];

// GET all applications
export async function GET() {
  try {
    // In a real app, you'd fetch from your database
    return NextResponse.json(mockDb);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST a new application
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation (in a real app, use Zod or similar)
    if (!body.applicant || !body.applicant.firstName) {
        return NextResponse.json({ error: 'Invalid application data' }, { status: 400 });
    }

    const newApplication: Application = {
      id: `app-${Date.now()}`,
      status: body.documents?.length > 0 ? 'pending' : 'incomplete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicant: body.applicant,
      vehicle: body.vehicle,
      guarantor: body.guarantor,
      documents: body.documents.map((doc: any) => ({
        id: `doc-${Date.now()}-${Math.random()}`,
        uploadedAt: new Date().toISOString(),
        ...doc,
      })),
      auditLog: [
        {
          timestamp: new Date().toISOString(),
          user: 'Applicant',
          action: 'Submitted application',
        },
      ],
    };
    
    mockDb.unshift(newApplication); // Add to the beginning of the array

    return NextResponse.json(newApplication, { status: 201 });
  } catch (error) {
    console.error("Error creating application:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
