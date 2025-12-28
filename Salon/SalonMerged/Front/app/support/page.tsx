'use client';

import { useState } from 'react';
import { Sparkles, Users, Play, MessageCircle, Lock, Zap, Palette, ArrowLeft, Menu, X, HelpCircle, Mail, Phone, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function SupportPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <Link href="/#features" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Zap size={18} />
              <span>Fonctionnalités</span>
            </Link>
            <Link href="/about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Sparkles size={18} />
              <span>À propos</span>
            </Link>
            <Link href="/contact" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <MessageCircle size={18} />
              <span>Contact</span>
            </Link>
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

      {/* Support Section */}
      <section className="about-section">
        <div className="about-content">
          <div className="about-header">
            <div className="badge">
              <HelpCircle className="badge-icon" size={16} />
              <span>Centre d'Aide</span>
            </div>

            <h1 className="about-title">
              Comment pouvons-nous vous aider ?
            </h1>

            <p className="about-description">
              Trouvez des réponses à vos questions et obtenez l'aide dont vous avez besoin.
              Notre équipe est là pour vous accompagner dans votre expérience NOVA.
            </p>
          </div>

          <div className="story-section">
            <h2 className="story-title">Questions Fréquentes</h2>
            <p className="story-text">
              Découvrez les réponses aux questions les plus courantes sur l'utilisation de NOVA Stream Sync.
              Si vous ne trouvez pas ce que vous cherchez, n'hésitez pas à nous contacter directement.
            </p>
          </div>

          <div className="mission-section">
            <h2 className="mission-title">Contactez-nous</h2>
            <div className="mission-grid">
              <div className="mission-card">
                <div className="mission-icon">
                  <Mail size={32} />
                </div>
                <h3>Email Support</h3>
                <p>
                  Envoyez-nous un email à support@nova-streamsync.com
                  pour toute question technique ou demande d'assistance.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <MessageSquare size={32} />
                </div>
                <h3>Chat en Direct</h3>
                <p>
                  Utilisez notre chat intégré dans l'application pour
                  une assistance rapide et personnalisée.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Phone size={32} />
                </div>
                <h3>Support Téléphonique</h3>
                <p>
                  Pour les urgences ou les problèmes critiques,
                  contactez notre ligne d'assistance 24/7.
                </p>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h2 className="tech-title">Ressources d'Aide</h2>
            <p className="tech-description">
              Explorez nos guides et tutoriels pour tirer le meilleur parti de NOVA Stream Sync.
            </p>

            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">Guide de Démarrage</span>
                <span className="tech-detail">Apprenez à créer votre premier salon et inviter des amis</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Fonctionnalités Avancées</span>
                <span className="tech-detail">Découvrez les playlists, le chat et les contrôles collaboratifs</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Dépannage</span>
                <span className="tech-detail">Résolvez les problèmes courants de synchronisation et de connexion</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">API Documentation</span>
                <span className="tech-detail">Pour les développeurs souhaitant intégrer NOVA</span>
              </div>
            </div>
          </div>
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
            <Link href="/" className="footer-link">Accueil</Link>
            <span className="footer-separator">•</span>
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
