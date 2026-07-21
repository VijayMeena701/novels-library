'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHomeData } from '../hooks/useHomeData';
import { useHomeSections } from '../hooks/useHomeSections';
import { HomeHero } from '../components/home/HomeHero';
import { FeatureGrid } from '../components/home/FeatureGrid';
import { UserLibrarySection } from '../components/home/UserLibrarySection';
import { FeaturedPick } from '../components/home/FeaturedPick';
import { BookSection } from '../components/home/BookSection';
import { RecentUpdates } from '../components/home/RecentUpdates';
import { HomeSidebar } from '../components/home/HomeSidebar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { cn } from '../lib/utils';

export default function PublicHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');

  const { books, libraryBooks, home, loading, libraryLoading } = useHomeData(user);
  const { sections, spotlightBook, userSections, showLongReads } = useHomeSections(books, libraryBooks, home);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    if (query) {
      router.push(`/books?search=${encodeURIComponent(query)}`);
    }
  };

  if (loading) {
    return (
      <div className={cn('mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12', 'flex flex-1 items-center justify-center py-24')}>
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <span className="text-sm text-muted-copy">Loading the library...</span>
        </div>
      </div>
    );
  }

  if (!books.length) {
    return (
      <div className={cn('mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12', 'py-12')}>
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="font-serif text-3xl font-medium text-foreground">Books Library</h1>
          <p className="mt-2 text-base text-muted-copy">The catalog is empty right now.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/books">Browse Catalog</Link>
            </Button>
            {user?.role === 'admin' && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/profile">Add a Book</Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12')}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] items-start">
        <main className="flex flex-col gap-6">
          <HomeHero
            user={user}
            pathname={pathname ?? ''}
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearch}
            totalBooks={home?.stats.totalBooks ?? books.length}
            totalChapters={home?.stats.totalChapters ?? sections.totalChapters}
            completedCount={sections.completed.length}
          />
          <FeatureGrid />
          {user && !libraryLoading && (
            <UserLibrarySection
              continueReading={userSections.continueReading}
              planning={userSections.planning}
              completed={userSections.completed}
              topRated={userSections.topRated}
              libraryEmpty={libraryBooks.length === 0}
            />
          )}
          {spotlightBook && <FeaturedPick book={spotlightBook} />}
          <BookSection title="New Arrivals" books={sections.newest} viewAllHref="/books" />
          {showLongReads && <BookSection title="Long Reads" books={sections.longReads} viewAllHref="/books?sort=translatedChaptersTotal" />}
          {home?.topVoted && home.topVoted.length > 0 && (
            <BookSection title="Top Voted" books={home.topVoted} viewAllHref="/books?sort=votes" />
          )}
          {home?.mostVisited && home.mostVisited.length > 0 && (
            <BookSection title="Most Visited" books={home.mostVisited} viewAllHref="/books?sort=visits" />
          )}
          <RecentUpdates books={sections.recent} />
        </main>
        <HomeSidebar
          ranked={sections.ranked}
          genres={sections.genres}
          completed={sections.completed}
          random={sections.random}
        />
      </div>
    </div>
  );
}
