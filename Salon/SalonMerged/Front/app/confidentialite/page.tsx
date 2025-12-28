'use client';

import { useState } from 'react';
import { Sparkles, Users, Play, MessageCircle, Lock, Zap, Palette, ArrowLeft, Menu, X, Shield, Eye, Database } from 'lucide-react';
import Link from 'next/link';

export default function ConfidentialitePage() {
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

      {/* Privacy Section */}
      <section className="about-section">
        <div className="about-content">
          <div className="about-header">
            <div className="badge">
              <Shield className="badge-icon" size={16} />
              <span>Politique de Confidentialité</span>
            </div>

            <h1 className="about-title">
              Protection de Vos Données Personnelles
            </h1>

            <p className="about-description">
              Chez NOVA, la confidentialité de vos données est notre priorité absolue.
              Découvrez comment nous collectons, utilisons et protégeons vos informations personnelles.
            </p>
          </div>

          <div className="story-section">
            <h2 className="story-title">Collecte des Données</h2>
            <p className="story-text">
              Nous collectons uniquement les informations nécessaires au fonctionnement de notre service.
              Cela inclut votre nom d'utilisateur (optionnel), les données de session pour la synchronisation,
              et les informations techniques pour améliorer votre expérience.
            </p>
            <p className="story-text">
              Toutes les données sont chiffrées et stockées de manière sécurisée. Nous n'utilisons pas
              vos données à des fins commerciales et ne les partageons jamais avec des tiers sans votre consentement explicite.
            </p>
          </div>

          <div className="mission-section">
            <h2 className="mission-title">Vos Droits</h2>
            <div className="mission-grid">
              <div className="mission-card">
                <div className="mission-icon">
                  <Eye size={32} />
                </div>
                <h3>Droit d'Accès</h3>
                <p>
                  Vous pouvez à tout moment consulter les données personnelles que nous détenons sur vous.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Database size={32} />
                </div>
                <h3>Droit de Suppression</h3>
                <p>
                  Vous pouvez demander la suppression complète de vos données à tout moment.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Lock size={32} />
                </div>
                <h3>Droit à la Portabilité</h3>
                <p>
                  Vous pouvez exporter vos données dans un format lisible et les transférer ailleurs.
                </p>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h2 className="tech-title">Sécurité des Données</h2>
            <p className="tech-description">
              Nous mettons en œuvre les meilleures pratiques de sécurité pour protéger vos informations.
            </p>

            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">Chiffrement</span>
                <span className="tech-detail">Toutes les données sont chiffrées en transit et au repos</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Accès Limité</span>
                <span className="tech-detail">Seul le personnel autorisé peut accéder aux données</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Conformité RGPD</span>
                <span className="tech-detail">Respect total des réglementations européennes</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Audits Réguliers</span>
                <span className="tech-detail">Vérifications de sécurité périodiques</span>
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
