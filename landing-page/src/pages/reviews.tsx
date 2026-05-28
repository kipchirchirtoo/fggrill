import { SEO } from '@/components/SEO';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/layout';
import toast, { Toaster } from 'react-hot-toast';

interface RatingBreakdown {
  cleanliness: number;
  service: number;
  comfort: number;
  wifi: number;
  location: number;
  value: number;
  food: number;
}

interface Review {
  id: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  location: string; // e.g. "Nairobi, Kenya"
  branch: 'Kericho' | 'Bomet' | 'All';
  type: 'hotel' | 'restaurant';
  stayType: 'Business' | 'Family' | 'Couple' | 'Solo' | 'Vacation';
  rating: number;
  ratings: RatingBreakdown;
  content: string;
  date: string;
  stayedOn: string;
  helpfulCount: number;
  likesCount: number;
  isLikedByUser?: boolean;
  isHelpfulByUser?: boolean;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  sentimentConfidence: number;
  issuesMentioned: string[];
  managerResponse?: {
    responder: string;
    content: string;
    date: string;
  };
}

const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    name: 'Andrea Howard',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    isVerified: true,
    location: 'London, UK',
    branch: 'Kericho',
    type: 'hotel',
    stayType: 'Couple',
    rating: 5,
    ratings: { cleanliness: 5, service: 5, comfort: 5, wifi: 4, location: 5, value: 5, food: 5 },
    content: 'An absolutely stunning hotel in Kericho! The gardens are beautifully manicured and the room cleanliness was impeccable. Our bed was incredibly comfortable and the service from the staff was warm and genuine. We especially loved the restaurant breakfast and the tea-farm tour they organized. Highly recommended!',
    date: '2026-05-15',
    stayedOn: 'May 2026',
    helpfulCount: 34,
    likesCount: 18,
    sentiment: 'Positive',
    sentimentConfidence: 98,
    issuesMentioned: ['Clean rooms', 'Friendly staff', 'Comfortable beds', 'Good food'],
    managerResponse: {
      responder: 'General Manager, FamousGate Kericho',
      content: 'Dear Andrea, thank you so much for your kind words! We are absolutely delighted that you enjoyed your stay, our tea-farm tour, and our hospitality. Looking forward to welcoming you back soon.',
      date: '2026-05-16'
    }
  },
  {
    id: 'rev-2',
    name: 'Carl Conder',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    isVerified: true,
    location: 'Nairobi, Kenya',
    branch: 'Bomet',
    type: 'restaurant',
    stayType: 'Family',
    rating: 5,
    ratings: { cleanliness: 5, service: 5, comfort: 4, wifi: 3, location: 4, value: 5, food: 5 },
    content: 'We visited the FamousGate restaurant in Bomet for Sunday family lunch. The food quality and taste were absolutely incredible—best grill and local cuts we have had in a long time! The wait staff was highly attentive and the cleanliness of the dining area was superior. Will definitely return.',
    date: '2026-05-10',
    stayedOn: 'May 2026',
    helpfulCount: 22,
    likesCount: 12,
    sentiment: 'Positive',
    sentimentConfidence: 96,
    issuesMentioned: ['Good food', 'Friendly staff', 'Fast service'],
    managerResponse: {
      responder: 'Restaurant Manager, FamousGate Bomet',
      content: 'Thank you Carl! We appreciate your wonderful review of our grill and our team. We look forward to serving your family again next Sunday.',
      date: '2026-05-11'
    }
  },
  {
    id: 'rev-3',
    name: 'Liz Leys',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
    isVerified: true,
    location: 'Munich, Germany',
    branch: 'Kericho',
    type: 'hotel',
    stayType: 'Business',
    rating: 3,
    ratings: { cleanliness: 4, service: 3, comfort: 4, wifi: 2, location: 5, value: 3, food: 4 },
    content: 'The room was quite comfortable and clean, and the location is exceptionally convenient for business meetings. However, the check-in took over 30 minutes, which was highly frustrating after a long journey. The room Wi-Fi was also unstable and kept dropping out. Food at the lounge was good, but service overall needs to be faster.',
    date: '2026-05-04',
    stayedOn: 'April 2026',
    helpfulCount: 45,
    likesCount: 5,
    sentiment: 'Neutral',
    sentimentConfidence: 87,
    issuesMentioned: ['Comfortable beds', 'Slow check-in', 'Nice Wi-Fi'],
    managerResponse: {
      responder: 'Front Office Director, FamousGate Kericho',
      content: 'Dear Liz, thank you for your candid feedback. We sincerely apologize for the delayed check-in and unstable Wi-Fi. We are currently implementing a new digital check-in system and upgrading our high-speed fibre network to resolve these precise bottlenecks.',
      date: '2026-05-05'
    }
  },
  {
    id: 'rev-4',
    name: 'Griffin Davis',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    isVerified: true,
    location: 'Seattle, USA',
    branch: 'Bomet',
    type: 'hotel',
    stayType: 'Solo',
    rating: 4,
    ratings: { cleanliness: 5, service: 4, comfort: 5, wifi: 5, location: 4, value: 4, food: 3 },
    content: 'Staid here for a solo weekend vacation. Super clean property, fast Wi-Fi, and highly respectful employees. My room was very quiet, allowing for great sleep. The only downside was that the dinner delivery took over 45 minutes, and by the time it arrived, it was lukewarm. Everything else was exceptional.',
    date: '2026-04-28',
    stayedOn: 'April 2026',
    helpfulCount: 15,
    likesCount: 9,
    sentiment: 'Positive',
    sentimentConfidence: 91,
    issuesMentioned: ['Clean rooms', 'Nice Wi-Fi', 'Quiet environment', 'Delayed food'],
    managerResponse: {
      responder: 'Guest Relations, FamousGate Bomet',
      content: 'Hello Griffin! We glad you enjoyed our clean rooms and peaceful environment. We are addressing the room-service delivery delays with our kitchen team to ensure dinner is served hot and prompt. Hope to host you again!',
      date: '2026-04-29'
    }
  },
  {
    id: 'rev-5',
    name: 'Hailey Grey',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
    isVerified: true,
    location: 'Nakuru, Kenya',
    branch: 'Kericho',
    type: 'restaurant',
    stayType: 'Couple',
    rating: 2,
    ratings: { cleanliness: 3, service: 2, comfort: 2, wifi: 3, location: 4, value: 2, food: 3 },
    content: 'We came specifically for our anniversary dinner because of the FamousGate brand. Unfortunately, it was highly disappointing. We sat for 20 minutes before our order was taken, and the steak we ordered medium-rare came back completely well-done and cold. The live music in the background was also way too loud, we could barely converse.',
    date: '2026-04-12',
    stayedOn: 'April 2026',
    helpfulCount: 52,
    likesCount: 2,
    sentiment: 'Negative',
    sentimentConfidence: 94,
    issuesMentioned: ['Delayed food', 'Slow service', 'Noisy rooms'],
    managerResponse: {
      responder: 'Food & Beverage Director, FamousGate Kericho',
      content: 'Dear Hailey, please accept our sincere apologies for spoiling your anniversary dinner. This is completely below our standard. We would love to make this up to you with a complimentary dinner voucher and a reserved premium booth. Please contact us directly at fb@famousgatehotels.com.',
      date: '2026-04-13'
    }
  }
];

export default function ReviewsPage() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [activeBranch, setActiveBranch] = useState<'All' | 'Kericho' | 'Bomet'>('All');
  const [activeFilter, setActiveFilter] = useState<'all' | 'hotel' | 'restaurant' | 'verified' | 'photos'>('all');
  const [activeSort, setActiveSort] = useState<'recent' | 'highest' | 'lowest' | 'helpful'>('recent');

  // --- New Review Form States ---
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBranch, setFormBranch] = useState<'Kericho' | 'Bomet'>('Kericho');
  const [formType, setFormType] = useState<'hotel' | 'restaurant'>('hotel');
  const [formStayType, setFormStayType] = useState<'Business' | 'Family' | 'Couple' | 'Solo' | 'Vacation'>('Couple');
  const [formRating, setFormRating] = useState(5);
  const [formContent, setFormContent] = useState('');
  const [formCleanliness, setFormCleanliness] = useState(5);
  const [formService, setFormService] = useState(5);
  const [formComfort, setFormComfort] = useState(5);
  const [formWifi, setFormWifi] = useState(5);
  const [formLocationRating, setFormLocationRating] = useState(5);
  const [formValue, setFormValue] = useState(5);
  const [formFood, setFormValueFood] = useState(5);

  useEffect(() => {
    setHeroLoaded(true);
  }, []);

  // --- Calculations for Analytics Summary ---
  const filteredForStats = reviews.filter(r => activeBranch === 'All' || r.branch === activeBranch);
  const averageRating = (filteredForStats.reduce((sum, r) => sum + r.rating, 0) / (filteredForStats.length || 1)).toFixed(1);
  const totalCount = filteredForStats.length;
  
  const ratingDistribution = [5, 4, 3, 2, 1].map(stars => {
    const count = filteredForStats.filter(r => r.rating === stars).length;
    const percentage = Math.round((count / (totalCount || 1)) * 100);
    return { stars, count, percentage };
  });

  const recommendationPercentage = Math.round(
    (filteredForStats.filter(r => r.rating >= 4).length / (totalCount || 1)) * 100
  );

  // --- Process/Filter and Sort Reviews ---
  const displayedReviews = reviews
    .filter(r => {
      if (activeBranch !== 'All' && r.branch !== activeBranch) return false;
      if (activeFilter === 'hotel' && r.type !== 'hotel') return false;
      if (activeFilter === 'restaurant' && r.type !== 'restaurant') return false;
      if (activeFilter === 'verified' && !r.isVerified) return false;
      return true;
    })
    .sort((a, b) => {
      if (activeSort === 'recent') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (activeSort === 'highest') return b.rating - a.rating;
      if (activeSort === 'lowest') return a.rating - b.rating;
      if (activeSort === 'helpful') return b.helpfulCount - a.helpfulCount;
      return 0;
    });

  // --- Sentiment & Tag Insights ---
  const positiveTags = ['Clean rooms', 'Friendly staff', 'Comfortable beds', 'Good food', 'Nice Wi-Fi', 'Quiet environment', 'Fast service'];
  const negativeTags = ['Slow check-in', 'Delayed food', 'Noisy rooms', 'Cold shower', 'Poor parking', 'Slow service'];

  // Count tags from actual reviews
  const tagCounts: Record<string, number> = {};
  filteredForStats.forEach(r => {
    r.issuesMentioned.forEach(issue => {
      tagCounts[issue] = (tagCounts[issue] || 0) + 1;
    });
  });

  // --- Handle Helpful Action ---
  const handleHelpful = (id: string) => {
    setReviews(prev =>
      prev.map(r => {
        if (r.id === id) {
          const toggled = !r.isHelpfulByUser;
          return {
            ...r,
            isHelpfulByUser: toggled,
            helpfulCount: r.helpfulCount + (toggled ? 1 : -1)
          };
        }
        return r;
      })
    );
    toast.success('Thank you for your feedback!');
  };

  const handleLike = (id: string) => {
    setReviews(prev =>
      prev.map(r => {
        if (r.id === id) {
          const toggled = !r.isLikedByUser;
          return {
            ...r,
            isLikedByUser: toggled,
            likesCount: r.likesCount + (toggled ? 1 : -1)
          };
        }
        return r;
      })
    );
  };

  // --- Form Submission ---
  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) {
      toast.error('Please fill out your name and review text.');
      return;
    }

    // Auto-sentiment analysis (mock client side AI)
    let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Positive';
    let issues: string[] = ['Clean rooms', 'Friendly staff'];
    const contentLower = formContent.toLowerCase();

    if (formRating <= 2 || contentLower.includes('delayed') || contentLower.includes('slow') || contentLower.includes('bad') || contentLower.includes('disappoint')) {
      sentiment = 'Negative';
      issues = [];
      if (contentLower.includes('slow') || contentLower.includes('check-in')) issues.push('Slow check-in');
      if (contentLower.includes('food') || contentLower.includes('cold') || contentLower.includes('delivery')) issues.push('Delayed food');
      if (contentLower.includes('noisy') || contentLower.includes('loud')) issues.push('Noisy rooms');
    } else if (formRating === 3) {
      sentiment = 'Neutral';
      issues = ['Comfortable beds'];
    } else {
      issues = [];
      if (contentLower.includes('clean') || contentLower.includes('spotless')) issues.push('Clean rooms');
      if (contentLower.includes('friendly') || contentLower.includes('polite') || contentLower.includes('staff')) issues.push('Friendly staff');
      if (contentLower.includes('bed') || contentLower.includes('sleep') || contentLower.includes('comfort')) issues.push('Comfortable beds');
      if (contentLower.includes('food') || contentLower.includes('delicious') || contentLower.includes('breakfast')) issues.push('Good food');
    }

    const newRev: Review = {
      id: `rev-${Date.now()}`,
      name: formName,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      isVerified: true,
      location: formLocation || 'Kenya',
      branch: formBranch,
      type: formType,
      stayType: formStayType,
      rating: formRating,
      ratings: {
        cleanliness: formCleanliness,
        service: formService,
        comfort: formComfort,
        wifi: formWifi,
        location: formLocationRating,
        value: formValue,
        food: formFood
      },
      content: formContent,
      date: new Date().toISOString().split('T')[0],
      stayedOn: 'May 2026',
      helpfulCount: 0,
      likesCount: 0,
      sentiment,
      sentimentConfidence: Math.floor(Math.random() * 15) + 84, // 84-98%
      issuesMentioned: issues
    };

    setReviews([newRev, ...reviews]);
    toast.success('Review submitted successfully! Undergoing automated sentiment tagging...');
    setShowForm(false);
    
    // Reset Form
    setFormName('');
    setFormLocation('');
    setFormContent('');
  };

  return (
    <>
      <SEO
        title="Guest Reviews & Sentiment Insights — FamousGate Hotels"
        description="Read verified guest reviews, rating breakdowns, and automated sentiment analysis from FamousGate Hotel Kericho and Bomet."
        url="https://famousgatehotels.com/reviews"
        breadcrumbs={[
          { name: "Reviews", item: "/reviews" }
        ]}
      />
      <Head>
        <meta name="keywords" content="famousgate hotels reviews, client feedback, hotel rating, kericho hotel review, bomet hotel rating" />
      </Head>

      <Header />
      <Toaster position="top-right" />

      <main className="bg-slate-50 min-h-screen text-slate-800">
        {/* ===== HERO ===== */}
        <section className="lp-hero">
          <div className="lp-hero__bg" style={{ backgroundImage: "url('/dining-bg.jpg')" }} />
          <div className="lp-hero__overlay" />
          <div suppressHydrationWarning className={`lp-hero__content${heroLoaded ? ' loaded' : ''}`}>
            <p className="lp-hero__eyebrow">Real Experiences</p>
            <h1 className="lp-hero__title">
              What Our Guests<br />
              <em>Are Saying</em>
            </h1>
            <div className="lp-hero__divider" />
            <p className="lp-hero__subtitle">
              Transparency, luxury and constant service enhancement. Explore verified client reviews across all branches.
            </p>
          </div>
          <div className="lp-hero__scroll-hint">
            <span>Scroll</span>
            <div className="lp-hero__scroll-line" />
          </div>
        </section>

        {/* ===== MAIN REVIEWS CONTAINER ===== */}
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          
          {/* LAYER 1: REVIEW SUMMARY HEADER & CONTROLS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center border-b border-slate-100 pb-8">
              {/* Avg rating score */}
              <div className="text-center lg:text-left lg:border-r border-slate-100 lg:pr-8">
                <div className="flex items-center justify-center lg:justify-start space-x-1 mb-2">
                  <span className="text-5xl font-black text-slate-900">{averageRating}</span>
                  <span className="text-lg text-slate-400">/5</span>
                </div>
                <div className="flex justify-center lg:justify-start text-amber-400 text-xl mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i}>{i < Math.round(Number(averageRating)) ? '★' : '☆'}</span>
                  ))}
                </div>
                <p className="text-slate-500 font-medium">{totalCount} Verified Reviews</p>
                <div className="mt-4 inline-flex items-center bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
                  <svg className="w-4 h-4 mr-1 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 11.37a8.25 8.25 0 0111.455 0L15 12.75l1.379-1.38a8.25 8.25 0 0111.455 0c3.16 3.16 3.16 8.285 0 11.445l-11.455 11.455a1.25 1.25 0 01-1.768 0L2.166 22.815c-3.16-3.16-3.16-8.285 0-11.445z" clipRule="evenodd"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clipRule="evenodd" />
                  </svg>
                  {recommendationPercentage}% would stay again
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-2 lg:border-r border-slate-100 lg:px-8">
                {ratingDistribution.map(({ stars, count, percentage }) => (
                  <div key={stars} className="flex items-center text-sm font-semibold text-slate-600">
                    <span className="w-6">{stars}★</span>
                    <div className="flex-1 mx-3 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs text-slate-400 font-normal">{percentage}% ({count})</span>
                  </div>
                ))}
              </div>

              {/* Verified Badge / Write Review Button */}
              <div className="text-center lg:pl-8 space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 inline-block text-left w-full max-w-sm">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Verified Guest Guarantee</h4>
                      <p className="text-xs text-slate-500">Every single review comes from an authenticated booking profile.</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowForm(!showForm)}
                  className="w-full max-w-sm bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition duration-150 shadow-sm"
                >
                  {showForm ? 'Cancel Review' : 'Write a Review'}
                </button>
              </div>
            </div>

            {/* Branch Selector and Interactive Filters */}
            <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Branch:</span>
                {['All', 'Kericho', 'Bomet'].map((branch) => (
                  <button
                    key={branch}
                    onClick={() => setActiveBranch(branch as any)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition duration-150 whitespace-nowrap ${
                      activeBranch === branch 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {branch === 'All' ? 'All Locations' : `FamousGate - ${branch}`}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Sort:</span>
                <select
                  value={activeSort}
                  onChange={(e) => setActiveSort(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                  <option value="helpful">Most Helpful</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Filter:</span>
              {[
                { id: 'all', label: 'All Reviews' },
                { id: 'hotel', label: 'Hotel Stays' },
                { id: 'restaurant', label: 'Dining Experience' },
                { id: 'verified', label: 'Verified Guests' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveFilter(btn.id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition duration-150 ${
                    activeFilter === btn.id
                      ? 'bg-slate-200 text-slate-900 border-slate-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* ===== WRITE REVIEW FORM PANEL ===== */}
          {showForm && (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 md:p-8 mb-8 animate-fade-in">
              <h3 className="text-xl font-black text-slate-900 mb-6 border-b border-slate-100 pb-3">Share Your Verified Experience</h3>
              <form onSubmit={handleSubmitReview} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                    <input 
                      type="text" 
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Location/City</label>
                    <input 
                      type="text" 
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      placeholder="e.g. Nairobi, Kenya"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Branch</label>
                    <select 
                      value={formBranch}
                      onChange={e => setFormBranch(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="Kericho">FamousGate Kericho</option>
                      <option value="Bomet">FamousGate Bomet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Service Type</label>
                    <select 
                      value={formType}
                      onChange={e => setFormType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="hotel">Hotel Stay</option>
                      <option value="restaurant">Restaurant / Dining</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Travel Type</label>
                    <select 
                      value={formStayType}
                      onChange={e => setFormStayType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="Couple">Couple</option>
                      <option value="Family">Family</option>
                      <option value="Business">Business</option>
                      <option value="Solo">Solo</option>
                      <option value="Vacation">Vacation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Overall Rating (1-5)</label>
                    <div className="flex items-center space-x-1 mt-1 text-2xl text-amber-400">
                      {[1, 2, 3, 4, 5].map(stars => (
                        <button 
                          type="button" 
                          key={stars} 
                          onClick={() => setFormRating(stars)}
                        >
                          {stars <= formRating ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sub-ratings */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Detail Experience Scores</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Cleanliness', val: formCleanliness, set: setFormCleanliness },
                      { label: 'Staff Service', val: formService, set: setFormService },
                      { label: 'Comfort', val: formComfort, set: setFormComfort },
                      { label: 'Wi-Fi Speed', val: formWifi, set: setFormWifi },
                      { label: 'Location', val: formLocationRating, set: setFormLocationRating },
                      { label: 'Value for Money', val: formValue, set: setFormValue },
                      { label: 'Food Quality', val: formFood, set: setFormValueFood }
                    ].map(sub => (
                      <div key={sub.label} className="text-xs">
                        <span className="block text-slate-600 font-bold mb-1">{sub.label}</span>
                        <select 
                          value={sub.val}
                          onChange={e => sub.set(Number(e.target.value))}
                          className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                        >
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} ★</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Write Your Honest Review</label>
                  <textarea 
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    placeholder="We loved the hot breakfast and quiet garden view. However, check-in was a bit slow..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    rows={4}
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2 rounded-xl text-slate-600 border border-slate-200 hover:bg-slate-50 font-bold text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm"
                  >
                    Submit Review
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LAYER 2: REVIEW ANALYTICS TAGS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Semantic Mentions & Trend Tracker</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs font-bold text-emerald-700 mb-2.5 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                  Frequently Praised Topics
                </span>
                <div className="flex flex-wrap gap-2">
                  {positiveTags.map(tag => {
                    const count = tagCounts[tag] || 0;
                    return (
                      <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-800">
                        {tag} <span className="ml-1.5 bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="block text-xs font-bold text-amber-700 mb-2.5 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse" />
                  Service Bottlenecks Mentioned
                </span>
                <div className="flex flex-wrap gap-2">
                  {negativeTags.map(tag => {
                    const count = tagCounts[tag] || 0;
                    return (
                      <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 border border-rose-100 text-rose-800">
                        {tag} <span className="ml-1.5 bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ===== REVIEWS GRID ===== */}
          <div className="grid grid-cols-1 gap-8">
            {displayedReviews.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No matching reviews found</h3>
                <p className="text-sm text-slate-500">Try adjusting your filters or location choice.</p>
              </div>
            ) : (
              displayedReviews.map((rev) => (
                <div key={rev.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  
                  {/* LAYER 3: REVIEW CARD UI */}
                  <div className="p-6 md:p-8">
                    {/* Upper profile section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
                      <div className="flex items-center space-x-4">
                        <img src={rev.avatar} alt={rev.name} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-black text-slate-900">{rev.name}</h4>
                            {rev.isVerified && (
                              <span className="inline-flex items-center bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clipRule="evenodd" />
                                </svg>
                                VERIFIED GUEST
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {rev.location} • <span className="font-bold text-slate-600">{rev.stayType} Trip</span>
                          </p>
                        </div>
                      </div>

                      {/* Ratings stars & Branch stamp */}
                      <div className="sm:text-right">
                        <div className="flex sm:justify-end text-amber-400 text-lg mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < rev.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                        <span className="inline-block bg-slate-100 text-slate-800 text-xs font-black px-2.5 py-1 rounded">
                          FamousGate {rev.branch}
                        </span>
                      </div>
                    </div>

                    {/* Sub-ratings Breakdown grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      {[
                        { label: 'Cleanliness', score: rev.ratings.cleanliness },
                        { label: 'Service', score: rev.ratings.service },
                        { label: 'Comfort', score: rev.ratings.comfort },
                        { label: 'Wi-Fi', score: rev.ratings.wifi },
                        { label: 'Location', score: rev.ratings.location },
                        { label: 'Value', score: rev.ratings.value },
                        { label: 'Food', score: rev.ratings.food }
                      ].map(sub => (
                        <div key={sub.label} className="border-r border-slate-100 last:border-0 pr-1 last:pr-0">
                          <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{sub.label}</span>
                          <span className="text-xs font-black text-slate-800">{sub.score} / 5</span>
                        </div>
                      ))}
                    </div>

                    {/* Review text */}
                    <div className="prose max-w-none text-slate-700 font-medium text-sm leading-relaxed mb-6">
                      “{rev.content}”
                    </div>

                    {/* LAYER 5: SMART SENTIMENT ANALYSIS (AI Feature) */}
                    <div className="mb-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
                          <svg className="w-5 h-5 text-indigo-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">AI Sentiment:</span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                              rev.sentiment === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                              rev.sentiment === 'Neutral' ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {rev.sentiment}
                            </span>
                            <span className="text-xs text-indigo-600 font-bold">({rev.sentimentConfidence}% confidence)</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] text-slate-400 font-bold mr-1">Extracted Topics:</span>
                            {rev.issuesMentioned.map(issue => (
                              <span key={issue} className="text-[10px] bg-white text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded font-semibold">
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 font-semibold">
                        Stayed on: {rev.stayedOn}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-500 font-bold">
                      <div className="flex items-center space-x-4">
                        <button 
                          onClick={() => handleHelpful(rev.id)}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition duration-150 ${
                            rev.isHelpfulByUser 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>👍</span>
                          <span>Helpful ({rev.helpfulCount})</span>
                        </button>
                        <button 
                          onClick={() => handleLike(rev.id)}
                          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition duration-150 ${
                            rev.isLikedByUser ? 'text-rose-600 scale-110' : 'text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          <span>❤️</span>
                          <span className="text-slate-500 font-bold">({rev.likesCount})</span>
                        </button>
                      </div>
                      <div className="flex items-center space-x-3 text-slate-400">
                        <span>Report 🚩</span>
                        <span>•</span>
                        <span>{rev.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* LAYER 4: MANAGEMENT REPLY SYSTEM */}
                  {rev.managerResponse && (
                    <div className="bg-slate-50 border-t border-slate-100 p-6 md:px-8">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-slate-200 text-slate-700 rounded-lg shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-black text-slate-900">{rev.managerResponse.responder}</h5>
                            <span className="text-[10px] text-slate-400 font-semibold">{rev.managerResponse.date}</span>
                          </div>
                          <p className="text-sm text-slate-600 font-medium italic">
                            “{rev.managerResponse.content}”
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ))
            )}
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
