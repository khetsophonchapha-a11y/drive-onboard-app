
import { NextResponse } from 'next/server';
import type { Application } from '@/lib/types';

// This is a mock database. In a real application, you would use a real database
// like Firestore, PostgreSQL, etc.
// The data needs to be pre-populated for GET to work on refresh.
// We are assuming the main `/api/applications` POST endpoint has been hit.
// This is a simplification for this mock setup.
let mockDb: Application[] = []; 

// Helper to find an application and its index
const findApplication = (id: string) => {
    // This is a hack for the mock DB. The main route populates the array.
    // To make this route work independently, we might need a shared mock DB instance.
    // For now, we assume the DB is populated.
    const index = mockDb.findIndex(app => app.id === id);
    return { application: mockDb[index], index };
}

// GET a single application by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch('http://localhost:3000/api/applications');
    mockDb = await res.json();
    const { application } = findApplication(params.id);

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    console.error(`Error fetching application ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


// DELETE an application by ID
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
   try {
    const res = await fetch('http://localhost:3000/api/applications');
    mockDb = await res.json();
    const { index } = findApplication(params.id);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    mockDb.splice(index, 1);

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error(`Error deleting application ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
