'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Play, MessageCircle, Lock, Zap, Palette, Sparkles, ArrowRight, Menu, X, User } from 'lucide-react';
import Link from 'next/link';
import { roomsApi } from './lib/api';

export default function HomePage() {
  const router = useRouter();

  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [joinName, setJoinName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [showQRCode, setShowQRCode] = useState(false);
const [qrCodeData, setQrCodeData] = useState('');



const handleCreateRoom = async () => {
  setCreateLoading(true);
  setCreateError('');

try {
    // Envoyer une chaîne vide si pas de nom
    const response = await roomsApi.createRoom(createName.trim() || "");
    const { code, creatorId } = response.data;

    router.push(`/rooms/${code}?memberId=${creatorId}&pseudo=${encodeURIComponent(createName.trim() || "")}`);
  } catch (err: any) {
    console.error('Erreur création:', err.response?.data);
    setCreateError(err.response?.data?.message || 'Erreur de création');
  } finally {
    setCreateLoading(false);
  }
};

const handleJoinRoom = async () => {
  if (!roomCode.trim()) {
    setJoinError('Veuillez entrer un code');
    return;
  }

  if (roomCode.length !== 6) {
    setJoinError('Le code doit contenir 6 caractères');
    return;
  }

  setJoinLoading(true);
  setJoinError('');

  try {
    // ⬇️ Envoyer une chaîne vide si pas de nom
    const response = await roomsApi.joinRoom(
      joinName.trim() || "",
      roomCode.toUpperCase(),
    );
    const { code, memberId } = response.data;

    router.push(`/rooms/${code}?memberId=${memberId}&pseudo=${encodeURIComponent(joinName.trim() || "")}`);
  } catch (err: any) {
    console.error('Erreur rejoindre:', err.response?.data);
    setJoinError(err.response?.data?.message || 'Erreur de connexion');
  } finally {
    setJoinLoading(false);
  }
};
  return (
    <div className="nova-container">
      {/* Background Effects */}
      <div className="particles">
        {[...Array(25)].map((_, i) => (
          <div 
            key={i} 
            className="particle" 
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }} 
          />
        ))}
      </div>

      {/* Header */}
      <header className="nova-header">
        <div className="header-wrapper">
          <div className="logo-container">
            <div className="logo-circle">
              <Sparkles className="logo-icon" size={24} />
            </div>
            <div className="logo-text-wrapper">
              <h1 className="logo-text">NOVA</h1>
              <span className="logo-tagline">Stream Sync</span>
            </div>
          </div>
          
          <nav className={`nav-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <a href="#features" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Zap size={18} />
              <span>Fonctionnalités</span>
            </a>
            <a href="/about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Sparkles size={18} />
              <span>À propos</span>
            </a>
            <a href="/contact" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <MessageCircle size={18} />
              <span>Contact</span>
            </a>
          </nav>

          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge">
            <Sparkles className="badge-icon" size={16} />
            <span>Regardez ensemble en temps réel</span>
          </div>
          
          <h1 className="hero-title">
            <span className="title-line">Streaming</span>
            <span className="title-line">Synchronisé</span>
            <span className="title-subtitle">Une expérience collective unique</span>
          </h1>
          
          <p className="hero-description">
            Créez des salons privés, invitez vos amis et profitez de vos contenus préférés 
            parfaitement synchronisés. L'expérience ultime du visionnage partagé.
          </p>
        </div>

        <div className="wave-divider">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" />
          </svg>
        </div>
      </section>

      {/* Main Cards Section */}
      <div className="main-section">
        <div className="cards-container">
          {/* Create Room Card - MODIFIÉ */}
          <div className="nova-card create-card">
            <div className="card-decoration"></div>
            
            <div className="card-header">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <Plus size={32} strokeWidth={2.5} />
                </div>
              </div>
              <div className="card-title-wrapper">
                <h2 className="card-title">Créer un Salon</h2>
                <div className="card-glow"></div>
              </div>
            </div>
            
            <p className="card-description">
              Initiez votre propre session de visionnage. Un code unique sera généré pour inviter vos amis instantanément.
            </p>
            
            <div className="form-group">
              <div className="input-wrapper">
                <div className="input-container">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                    placeholder="Votre nom (optionnel)"
                    className="nova-input"
                    disabled={createLoading}
                  />
                </div>
                <div className="input-border"></div>
              </div>
              
              <button
                onClick={handleCreateRoom}
                disabled={createLoading}
                className="nova-btn nova-btn-primary"
              >
                {createLoading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Création en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Lancer le Salon</span>
                    <ArrowRight size={20} className="btn-arrow" />
                  </>
                )}
              </button>
              
              {createError && (
                <div className="error-message">
                  <span className="error-icon"></span>
                  <span>{createError}</span>
                </div>
              )}
            </div>
            
            <div className="card-tip">
              <Sparkles size={16} className="tip-icon" />
              <span>Laissez vide pour un pseudonyme généré automatiquement</span>
            </div>
          </div>

          {/* Join Room Card - MODIFIÉ */}
          <div className="nova-card join-card">
            <div className="card-decoration"></div>
            
            <div className="card-header">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <Users size={32} strokeWidth={2.5} />
                </div>
              </div>
              <div className="card-title-wrapper">
                <h2 className="card-title">Rejoindre un Salon</h2>
                <div className="card-glow"></div>
              </div>
            </div>
            
            <p className="card-description">
              Connectez-vous à une session existante avec le code d'invitation. Rejoignez vos amis en quelques secondes.
            </p>
            
            <div className="form-group">
              <div className="input-wrapper">
                <div className="input-container">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Votre nom (optionnel)"
                    className="nova-input"
                    disabled={joinLoading}
                  />
                </div>
                <div className="input-border"></div>
              </div>
              
              <div className="input-wrapper">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="CODE (6 lettres)"
                  maxLength={6}
                  className="nova-input input-code"
                  disabled={joinLoading}
                />
                <div className="input-border"></div>
                <div className="code-hint">Majuscules uniquement</div>
              </div>
              
              <button
                onClick={handleJoinRoom}
                disabled={joinLoading}
                className="nova-btn nova-btn-secondary"
              >
                {joinLoading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <span>Rejoindre la Session</span>
                    <ArrowRight size={20} className="btn-arrow" />
                  </>
                )}
              </button>
              
              {joinError && (
                <div className="error-message">
                  <span className="error-icon"></span>
                  <span>{joinError}</span>
                </div>
              )}
            </div>
            
            <div className="card-tip">
              <Sparkles size={16} className="tip-icon" />
              <span>Laissez vide pour un pseudonyme généré automatiquement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">Fonctionnalités Avancées</h2>
          <p className="section-subtitle">
            Une expérience de streaming collaborative comme jamais auparavant
          </p>
        </div>
        
        <div className="features-grid">
          {[
            {
              icon: Play,
              title: 'Synchronisation Parfaite',
              description: 'Lecture, pause et navigation synchronisés en temps réel pour tous les participants'
            },
            {
              icon: MessageCircle,
              title: 'Chat en Direct',
              description: 'Discutez avec vos amis pendant le visionnage avec notre chat intégré'
            },
            {
              icon: Users,
              title: 'Contrôle Collaboratif',
              description: 'Chaque participant peut contrôler la lecture de manière collaborative'
            },
            {
              icon: Lock,
              title: 'Salons Privés',
              description: 'Vos sessions sont sécurisées et accessibles uniquement par invitation'
            },
            {
              icon: Zap,
              title: 'Performance Optimale',
              description: 'Streaming fluide et sans latence grâce à notre infrastructure optimisée'
            },
            {
              icon: Palette,
              title: 'Interface Élégante',
              description: 'Design moderne et intuitif pour une expérience utilisateur exceptionnelle'
            }
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="feature-card">
                <div className="feature-icon-wrapper">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="nova-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <Sparkles size={24} />
              <span>NOVA</span>
            </div>
            <p className="footer-tagline">
              Streaming synchronisé pour des moments partagés inoubliables
            </p>
          </div>
          
          <div className="footer-links">
            <Link href="/confidentialite" className="footer-link">Confidentialité</Link>
            <span className="footer-separator">•</span>
            <Link href="/conditions" className="footer-link">Conditions</Link>
            <span className="footer-separator">•</span>
            <Link href="/support" className="footer-link">Support</Link>
          </div>
          
          <div className="footer-copyright">
            © 2024 NOVA Stream Sync. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
