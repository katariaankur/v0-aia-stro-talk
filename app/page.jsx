import Nav from '@/components/Nav';
import Link from 'next/link';

export default function Home(){
  return (
    <main>
      <Nav/>
      <section className="section py-10">
        <div className="rounded-3xl p-10 gradient-hero text-white">
          <div className="text-4xl font-bold">Chat for Free</div>
          <p className="mt-2 max-w-xl text-white/90">Talk with our AI astrologer for personalized guidance—ask anything and start navigating your amazing life today.</p>
          <div className="mt-5 flex gap-3">
            <Link href="/live" className="btn bg-white text-[#5E39FF]">Start Live →</Link>
            <Link href="/live" className="btn btn-outline bg-white/10 text-white">Try Palm Scan</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
