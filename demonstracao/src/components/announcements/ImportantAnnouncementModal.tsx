 import { motion, AnimatePresence } from 'framer-motion';
 import { X, Sparkles } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 
 const BORDER_STYLES: Record<string, string> = {
   'gradient-blue': 'border-4 border-blue-500 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-500/10',
   'gradient-red': 'border-4 border-red-500 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-red-500/10',
   'gradient-green': 'border-4 border-green-500 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10',
   'gradient-purple': 'border-4 border-purple-500 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-500/10',
   'gradient-gold': 'border-4 border-yellow-500 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-yellow-500/10',
   'solid-blue': 'border-4 border-blue-500 bg-blue-500/5',
   'solid-red': 'border-4 border-red-500 bg-red-500/5',
   'dashed-blue': 'border-4 border-dashed border-blue-500 bg-blue-500/5',
 };
 
 interface ImportantAnnouncementModalProps {
   isOpen: boolean;
   onClose: () => void;
   title: string;
   content: string;
   borderStyle: string;
 }
 
 export function ImportantAnnouncementModal({
   isOpen,
   onClose,
   title,
   content,
   borderStyle,
 }: ImportantAnnouncementModalProps) {
   const borderClassName = BORDER_STYLES[borderStyle] || BORDER_STYLES['gradient-blue'];
 
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
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 20 }}
             transition={{ type: 'spring', damping: 25, stiffness: 300 }}
             className={`relative z-10 w-full max-w-lg rounded-2xl bg-card shadow-2xl overflow-hidden ${borderClassName}`}
           >
             {/* Decorative sparkles */}
             <div className="absolute -top-2 -right-2 text-yellow-400 animate-pulse">
               <Sparkles className="h-8 w-8" />
             </div>
             <div className="absolute -bottom-2 -left-2 text-yellow-400 animate-pulse delay-300">
               <Sparkles className="h-6 w-6" />
             </div>
 
             {/* Content */}
             <div className="p-6">
               {/* Header */}
               <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                     <Sparkles className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                     <h2 className="font-display text-xl font-bold text-foreground">
                       {title}
                     </h2>
                     <p className="text-sm text-muted-foreground">Comunicado Importante</p>
                   </div>
                 </div>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={onClose}
                   className="rounded-full"
                 >
                   <X className="h-5 w-5" />
                 </Button>
               </div>
 
               {/* Message */}
               <div className="rounded-xl bg-muted/50 p-4 mb-6">
                 <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                   {content}
                 </p>
               </div>
 
               {/* Action */}
               <Button
                 onClick={onClose}
                 className="w-full gradient-primary"
               >
                 Entendido
               </Button>
             </div>
           </motion.div>
         </motion.div>
       )}
     </AnimatePresence>
   );
 }