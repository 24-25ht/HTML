import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Navigation, MapPin, Sparkles, Moon, Star } from 'lucide-react';

export default function QiblaFinder() {
  const [qiblaDirection, setQiblaDirection] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (err) => {
          setError("Please enable location access to find Qibla direction");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (latitude && longitude) {
      fetch(`https://api.aladhan.com/v1/qibla/${latitude}/${longitude}`)
        .then((res) => res.json())
        .then((data) => {
          setQiblaDirection(data.data.direction);
          setLoading(false);
        })
        .catch(() => {
          setError("Failed to fetch Qibla direction");
          setLoading(false);
        });
    }
  }, [latitude, longitude]);

  const requestCompassPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          startCompass();
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setPermissionGranted(true);
      startCompass();
    }
  };

  const startCompass = () => {
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);
  };

  const handleOrientation = (event) => {
    let heading = event.webkitCompassHeading || Math.abs(event.alpha - 360);
    if (heading !== undefined) {
      setDeviceHeading(heading);
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const qiblaFromNorth = qiblaDirection ? qiblaDirection - deviceHeading : 0;

  const floatingStars = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 2 + Math.random() * 3,
    size: 4 + Math.random() * 8,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background stars */}
      {floatingStars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Glowing orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.8) 0%, transparent 70%)',
          top: '-10%',
          right: '-10%',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, transparent 70%)',
          bottom: '-10%',
          left: '-10%',
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-8 relative z-10"
      >
        <motion.div
          className="flex items-center justify-center gap-3 mb-2"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Moon className="w-8 h-8 text-amber-300" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            Qibla Finder
          </h1>
          <Star className="w-8 h-8 text-amber-300" />
        </motion.div>
        <p className="text-indigo-200 text-lg font-light tracking-wide">
          Find the direction of the Holy Kaaba
        </p>
      </motion.div>

      {/* Main compass container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10"
      >
        {loading ? (
          <motion.div
            className="w-80 h-80 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.8), rgba(49, 46, 129, 0.4))',
              boxShadow: '0 0 60px rgba(139, 92, 246, 0.3), inset 0 0 30px rgba(139, 92, 246, 0.1)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Compass className="w-20 h-20 text-indigo-300" />
            </motion.div>
          </motion.div>
        ) : error ? (
          <div
            className="w-80 h-80 rounded-full flex items-center justify-center p-8 text-center"
            style={{
              background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.8), rgba(49, 46, 129, 0.4))',
              boxShadow: '0 0 60px rgba(239, 68, 68, 0.3)',
            }}
          >
            <p className="text-red-300 text-lg">{error}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, #8b5cf6, #3b82f6, #06b6d4, #10b981, #eab308, #f97316, #ef4444, #8b5cf6)',
                filter: 'blur(20px)',
                opacity: 0.4,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />

            {/* Main compass */}
            <motion.div
              className="relative w-80 h-80 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.9))',
                boxShadow: '0 0 80px rgba(139, 92, 246, 0.4), 0 0 120px rgba(59, 130, 246, 0.2), inset 0 0 40px rgba(139, 92, 246, 0.15)',
                border: '2px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              {/* Compass rose background */}
              <div className="absolute inset-4 rounded-full border border-indigo-500/20" />
              <div className="absolute inset-8 rounded-full border border-indigo-500/15" />
              <div className="absolute inset-12 rounded-full border border-indigo-500/10" />

              {/* Cardinal directions */}
              {['N', 'E', 'S', 'W'].map((dir, i) => (
                <motion.div
                  key={dir}
                  className="absolute text-indigo-300 font-bold text-lg"
                  style={{
                    top: i === 0 ? '12%' : i === 2 ? '82%' : '46%',
                    left: i === 3 ? '10%' : i === 1 ? '85%' : '48%',
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                >
                  {dir}
                </motion.div>
              ))}

              {/* Qibla arrow */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: qiblaFromNorth }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
              >
                <motion.div
                  className="relative"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Arrow glow */}
                  <div
                    className="absolute -inset-4 rounded-full opacity-50"
                    style={{
                      background: 'radial-gradient(circle, rgba(234, 179, 8, 0.6) 0%, transparent 70%)',
                      filter: 'blur(10px)',
                    }}
                  />
                  
                  {/* Main arrow */}
                  <Navigation
                    className="w-24 h-24 text-amber-400 drop-shadow-lg"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(234, 179, 8, 0.8))',
                    }}
                  />
                </motion.div>
              </motion.div>

              {/* Center decoration */}
              <motion.div
                className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600"
                style={{
                  boxShadow: '0 0 30px rgba(234, 179, 8, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.3)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(234, 179, 8, 0.6)',
                    '0 0 50px rgba(234, 179, 8, 0.8)',
                    '0 0 30px rgba(234, 179, 8, 0.6)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Info cards */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-8 flex flex-col sm:flex-row gap-4 relative z-10"
      >
        <motion.div
          className="px-6 py-4 rounded-2xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.6), rgba(49, 46, 129, 0.3))',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(139, 92, 246, 0.3)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-300 text-sm">Your Location</span>
          </div>
          <p className="text-white font-semibold">
            {latitude && longitude
              ? `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`
              : 'Locating...'}
          </p>
        </motion.div>

        <motion.div
          className="px-6 py-4 rounded-2xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.6), rgba(49, 46, 129, 0.3))',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 12px 40px rgba(234, 179, 8, 0.3)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-amber-200 text-sm">Qibla Direction</span>
          </div>
          <p className="text-white font-semibold">
            {qiblaDirection ? `${qiblaDirection.toFixed(2)}° from North` : 'Calculating...'}
          </p>
        </motion.div>
      </motion.div>

      {/* Compass activation button */}
      {!permissionGranted && !loading && !error && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={requestCompassPermission}
          className="mt-6 px-8 py-3 rounded-full font-semibold text-white relative overflow-hidden z-10"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.span
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="relative flex items-center gap-2">
            <Compass className="w-5 h-5" />
            Enable Live Compass
          </span>
        </motion.button>
      )}

      {/* Kaaba indicator text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-6 text-indigo-200/60 text-sm text-center z-10"
      >
        Point the golden arrow towards the Qibla
      </motion.p>
    </div>
  );
}