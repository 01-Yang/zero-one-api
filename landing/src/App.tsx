import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, Menu, X } from 'lucide-react'
import Threads from './components/Threads'
import {
  DEFAULT_PUBLIC_SETTINGS,
  fetchPublicSettings,
  type PublicSettings,
} from './lib/publicSettings'

const API_ENDPOINT = 'https://api.01yapi.com'
const CONSOLE_ORIGIN = 'https://app.01yapi.com'

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    return copied
  }
}

export default function App() {
  const [settings, setSettings] = useState<PublicSettings>({ ...DEFAULT_PUBLIC_SETTINGS })
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    let active = true
    void fetchPublicSettings().then((nextSettings) => {
      if (active) setSettings(nextSettings)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setLogoFailed(false)
  }, [settings.siteLogo])

  const handleCopy = async () => {
    const succeeded = await copyText(API_ENDPOINT)
    if (!succeeded) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  const closeMenu = () => setMenuOpen(false)
  const showLogo = Boolean(settings.siteLogo) && !logoFailed

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="/" aria-label={`${settings.siteName} 首页`}>
            {showLogo ? (
              <img
                className="wordmark-logo"
                src={settings.siteLogo}
                alt=""
                onError={() => setLogoFailed(true)}
              />
            ) : null}
            <span>{settings.siteName}</span>
          </a>

          <nav className="desktop-nav" aria-label="主要导航">
            <a href={`${CONSOLE_ORIGIN}/model-plaza`}>模型广场</a>
            {settings.docUrl ? (
              <a href={settings.docUrl} target="_blank" rel="noreferrer">
                文档
              </a>
            ) : null}
            <a href={`${CONSOLE_ORIGIN}/login`}>登录</a>
            {settings.registrationEnabled ? (
              <a className="nav-primary" href={`${CONSOLE_ORIGIN}/register`}>
                注册
              </a>
            ) : null}
          </nav>

          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? '关闭导航' : '打开导航'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="移动导航"
          hidden={!menuOpen}
        >
          <a href={`${CONSOLE_ORIGIN}/model-plaza`} onClick={closeMenu}>
            模型广场
          </a>
          {settings.docUrl ? (
            <a href={settings.docUrl} target="_blank" rel="noreferrer" onClick={closeMenu}>
              文档
            </a>
          ) : null}
          <a href={`${CONSOLE_ORIGIN}/login`} onClick={closeMenu}>
            登录
          </a>
          {settings.registrationEnabled ? (
            <a href={`${CONSOLE_ORIGIN}/register`} onClick={closeMenu}>
              注册
            </a>
          ) : null}
        </nav>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <Threads />
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-content">
            <h1 id="hero-title">零一 API</h1>
            <p className="hero-subtitle">{settings.siteSubtitle}</p>

            <div className="endpoint" aria-label="推荐 API 地址">
              <code>{API_ENDPOINT}</code>
              <button
                className="copy-button"
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'API 地址已复制' : '复制 API 地址'}
                title={copied ? '已复制' : '复制 API 地址'}
              >
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </button>
            </div>
            <span className="copy-status" role="status" aria-live="polite">
              {copied ? '已复制' : ''}
            </span>

            <div className="hero-actions">
              {settings.registrationEnabled ? (
                <a className="button button-primary" href={`${CONSOLE_ORIGIN}/register`}>
                  注册账号
                </a>
              ) : null}
              <a className="button button-secondary" href={`${CONSOLE_ORIGIN}/login`}>
                登录控制台
              </a>
              <a className="text-action" href={`${CONSOLE_ORIGIN}/model-plaza`}>
                查看模型
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="destinations" aria-label="产品入口">
          <div className="destination-inner">
            <a className="destination-link" href={`${CONSOLE_ORIGIN}/dashboard`}>
              <span>控制台</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="destination-link" href={`${CONSOLE_ORIGIN}/model-plaza`}>
              <span>模型广场</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="destination-link" href={`${CONSOLE_ORIGIN}/redeem`}>
              <span>兑换中心</span>
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} 零一 API</span>
        <a href="/_landing/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
          第三方许可
        </a>
      </footer>
    </div>
  )
}
