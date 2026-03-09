'use client';

import { useState } from 'react';
import { Sparkles, Users, Play, MessageCircle, Lock, Zap, Palette, ArrowLeft, Menu, X, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ConditionsPage() {
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

      {/* Terms Section */}
      <section className="about-section">
        <div className="about-content">
          <div className="about-header">
            <div className="badge">
              <FileText className="badge-icon" size={16} />
              <span>Conditions Générales d'Utilisation</span>
            </div>

            <h1 className="about-title">
              Règles d'Utilisation du Service
            </h1>

            <p className="about-description">
              Découvrez les conditions générales qui régissent l'utilisation de NOVA Stream Sync.
              Ces règles garantissent une expérience sûre et agréable pour tous nos utilisateurs.
            </p>
          </div>

          <div className="story-section">
            <h2 className="story-title">Acceptation des Conditions</h2>
            <p className="story-text">
              En accédant et en utilisant NOVA Stream Sync, vous acceptez d'être lié par ces conditions générales d'utilisation.
              Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
            </p>
            <p className="story-text">
              Ces conditions s'appliquent à tous les visiteurs, utilisateurs et autres personnes qui accèdent ou utilisent le service.
              Elles constituent l'accord complet entre vous et NOVA concernant l'utilisation du service.
            </p>
          </div>

          <div className="mission-section">
            <h2 className="mission-title">Règles d'Utilisation</h2>
            <div className="mission-grid">
              <div className="mission-card">
                <div className="mission-icon">
                  <CheckCircle size={32} />
                </div>
                <h3>Utilisation Autorisée</h3>
                <p>
                  Le service est destiné au visionnage partagé de contenu légal uniquement.
                  Respectez les droits d'auteur et les lois en vigueur.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <AlertTriangle size={32} />
                </div>
                <h3>Interdictions</h3>
                <p>
                  Toute utilisation abusive, diffusion de contenu illégal ou nuisible
                  est strictement interdite et peut entraîner la suspension du compte.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Users size={32} />
                </div>
                <h3>Responsabilité</h3>
                <p>
                  Vous êtes responsable de vos actions sur la plateforme.
                  Respectez les autres utilisateurs et maintenez un environnement positif.
                </p>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h2 className="tech-title">Droits et Obligations</h2>
            <p className="tech-description">
              Comprenez vos droits et devoirs en tant qu'utilisateur de NOVA Stream Sync.
            </p>

            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">Confidentialité</span>
                <span className="tech-detail">Vos données personnelles sont protégées selon notre politique de confidentialité</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Disponibilité</span>
                <span className="tech-detail">Le service est fourni "tel quel" sans garantie de disponibilité continue</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Modifications</span>
                <span className="tech-detail">Nous nous réservons le droit de modifier ces conditions à tout moment</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Résiliation</span>
                <span className="tech-detail">Vous pouvez résilier votre compte à tout moment depuis vos paramètres</span>
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
