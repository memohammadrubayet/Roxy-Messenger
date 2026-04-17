import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageSquare, Mail, Lock, User as UserIcon, Calendar, Globe, Phone } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'register' | 'forgot_password';

export function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please enter email and password');
    
    setLoading(true);
    try {
      // Simulate phone number logic if it doesn't contain an @
      if (!email.includes('@')) {
        toast.info('Phone auth is simulated in this preview environment. Please use an email address.');
        setLoading(false);
        return;
      }
      
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return toast.error('Please fill in required fields');
    
    if (!email.includes('@')) {
      toast.info('Phone OTP is simulated. Please use an email address to fully register.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, {
        displayName: name
      });

      // Save additional profile data to Firestore
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        uid: userCredential.user.uid,
        displayName: name,
        email,
        dob,
        country,
        phone,
        status: 'online',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });

      toast.success('Registration successful!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email');
    
    setLoading(true);
    try {
      if (!email.includes('@')) {
        if (!otpSent) {
          setOtpSent(true);
          toast.success('Simulated OTP sent to phone number!');
        } else {
          if (otp === '123456') {
            toast.success('OTP verified! (Simulated password reset)');
            setMode('login');
          } else {
            toast.error('Invalid OTP. Use 123456');
          }
        }
        setLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
      setMode('login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-950 p-4">
      <div className="flex w-full max-w-md flex-col items-center space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
          <MessageSquare size={32} />
        </div>
        
        <div className="space-y-1 text-center w-full">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {mode === 'login' ? 'Sign in to your account to continue.' : 
             mode === 'register' ? 'Fill in your details to get started.' : 
             'Enter your email or phone to reset password.'}
          </p>
        </div>

        <form className="w-full space-y-4" onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgotPassword}>
          
          {mode === 'register' && (
            <>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                <Input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="pl-10 bg-zinc-950/50 border-zinc-800" required />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                <Input type="date" placeholder="Date of Birth" value={dob} onChange={e => setDob(e.target.value)} className="pl-10 bg-zinc-950/50 border-zinc-800 text-zinc-400" />
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                <Input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} className="pl-10 bg-zinc-950/50 border-zinc-800" />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
            <Input 
              placeholder="Email or Phone Number" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="pl-10 bg-zinc-950/50 border-zinc-800" 
              required 
            />
          </div>

          {(mode === 'login' || mode === 'register') && (
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="pl-10 bg-zinc-950/50 border-zinc-800" 
                required={mode !== 'forgot_password'}
              />
            </div>
          )}

          {mode === 'forgot_password' && otpSent && !email.includes('@') && (
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
              <Input 
                placeholder="Enter OTP (123456)" 
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                className="pl-10 bg-zinc-950/50 border-zinc-800" 
                required 
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setMode('forgot_password')} className="text-xs text-indigo-400 hover:text-indigo-300">
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11" disabled={loading}>
            {loading ? 'Processing...' : 
             mode === 'login' ? 'Sign In' : 
             mode === 'register' ? 'Create Account' : 
             (otpSent ? 'Verify OTP' : 'Send Reset Link')}
          </Button>
        </form>

        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900/50 px-2 text-zinc-500">Or continue with</span>
          </div>
        </div>

        <Button type="button" variant="outline" onClick={handleGoogleLogin} className="w-full border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800 h-11 text-zinc-300">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </Button>

        <div className="text-center text-sm text-zinc-400">
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')} 
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
