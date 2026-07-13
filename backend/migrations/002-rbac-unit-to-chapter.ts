/// <reference types="node" />
import 'dotenv/config';

type MongoDb = any;

export async function renameRbacTerminology(db: MongoDb, dryRun: boolean): Promise<void> {
  const unitsResource = await db.collection('resources').findOne({ key: 'units' });
  if (!unitsResource) {
    console.log('No RBAC resource with key "units" found. Nothing to migrate.');
    return;
  }

  const chaptersResource = await db.collection('resources').findOne({ key: 'chapters' });

  if (dryRun) {
    console.log(`[dry-run] would migrate RBAC "units" resource to "chapters"`);
    return;
  }

  if (!chaptersResource) {
    // Simple rename: no "chapters" resource exists yet.
    await db
      .collection('resources')
      .updateOne({ _id: unitsResource._id }, { $set: { key: 'chapters', name: 'Chapters', updatedAt: new Date() } });
    console.log('Renamed RBAC resource "units" -> "chapters".');

    // Any capability that referenced the old units resource now implicitly points to the renamed one.
    await db.collection('accessgroups').updateMany(
      { resource: unitsResource._id },
      { $set: { resource: unitsResource._id } }, // no-op; kept for clarity
    );
  } else {
    // Merge: a "chapters" resource already exists. Move capabilities and references over.
    const unitCaps = await db.collection('capabilities').find({ resource: unitsResource._id }).toArray();
    const chapterCaps = await db.collection('capabilities').find({ resource: chaptersResource._id }).toArray();
    const chapterCapByAction = new Map<string, any>();
    for (const cap of chapterCaps) {
      chapterCapByAction.set(cap.action.toString(), cap);
    }

    for (const unitCap of unitCaps) {
      const chapterCap = chapterCapByAction.get(unitCap.action.toString());
      if (chapterCap) {
        // Replace old capability reference with the new chapter capability in all access groups.
        // MongoDB cannot apply $addToSet and $pull on the same path in one update, so split into two.
        await db
          .collection('accessgroups')
          .updateMany({ capabilities: unitCap._id }, { $addToSet: { capabilities: chapterCap._id } });
        await db
          .collection('accessgroups')
          .updateMany({ capabilities: unitCap._id }, { $pull: { capabilities: unitCap._id } });
        await db.collection('capabilities').deleteOne({ _id: unitCap._id });
      } else {
        // No matching chapter capability; re-parent the unit capability under the chapters resource.
        await db
          .collection('capabilities')
          .updateOne({ _id: unitCap._id }, { $set: { resource: chaptersResource._id, updatedAt: new Date() } });
      }
    }

    // Update any access group that still points to the units resource.
    await db
      .collection('accessgroups')
      .updateMany({ resource: unitsResource._id }, { $set: { resource: chaptersResource._id, updatedAt: new Date() } });

    // Remove the stale units resource.
    await db.collection('resources').deleteOne({ _id: unitsResource._id });
    console.log('Merged RBAC "units" resource into existing "chapters" resource.');
  }

  console.log('RBAC unit-to-chapter migration completed.');
}
