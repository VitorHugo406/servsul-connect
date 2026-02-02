import { motion, AnimatePresence } from 'framer-motion';
import { PartyPopper, Cake, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BirthdayCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export function BirthdayCelebrationModal({ isOpen, onClose, userName }: BirthdayCelebrationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-1 shadow-2xl"
          >
            <div className="rounded-[22px] bg-card p-6 text-center">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Animated icons */}
              <div className="mb-6 flex justify-center gap-4">
                <motion.div
                  animate={{ rotate: [-10, 10, -10] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <PartyPopper className="h-12 w-12 text-yellow-500" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Cake className="h-16 w-16 text-pink-500" />
                </motion.div>
                <motion.div
                  animate={{ rotate: [10, -10, 10] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <PartyPopper className="h-12 w-12 text-yellow-500" />
                </motion.div>
              </div>

              {/* Text */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-2 font-display text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent"
              >
                Feliz Aniversário! 🎉
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6 text-xl font-medium text-foreground"
              >
                {userName}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6 text-muted-foreground"
              >
                Toda a equipe do Grupo Servsul deseja a você um dia muito especial! 
                Que este novo ano de vida seja repleto de conquistas, alegrias e realizações.
              </motion.p>

              {/* Animated emojis */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-6 flex justify-center gap-2 text-2xl"
              >
                {['🎂', '🎈', '🎁', '🎊', '🎉', '🥳'].map((emoji, index) => (
                  <motion.span
                    key={index}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1, 
                      delay: index * 0.1,
                      ease: 'easeInOut'
                    }}
                  >
                    {emoji}
                  </motion.span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={onClose}
                  className="w-full rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 py-3 text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-shadow"
                >
                  Obrigado! 💜
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
