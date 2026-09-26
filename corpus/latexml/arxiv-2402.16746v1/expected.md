# Asymptotic-preserving and energy stable dynamical low-rank approximation for thermal radiative transfer equations

Chinmay Patwardhan, Martin Frank, Jonas Kusch  
2024  
arXiv: 2402.16746v1

## Abstract

The thermal radiative transfer equations model temperature evolution through a background medium as a result of radiation. When a large number of particles are absorbed in a short time scale, the dynamics tend to a non-linear diffusion-type equation called the Rosseland approximation. The main challenges for constructing numerical schemes that exhibit the correct limiting behavior are posed by the solution’s high-dimensional phase space and multi-scale effects. In this work, we propose an asymptotic-preserving and rank-adaptive dynamical low-rank approximation scheme based on the macro-micro decomposition of the particle density and a modified augmented basis-update & Galerkin integrator. We show that this scheme, for linear particle emission by the material, dissipates energy over time under a step size restriction that captures the hyperbolic and parabolic CFL conditions. We demonstrate the efficacy of the proposed method in a series of numerical experiments.

*Keywords: thermal radiative transfer equations, energy stability, asymptotic-preserving scheme, dynamical low-rank approximation, macro-micro decomposition*

## 1 Introduction

The radiation of particles from a hot source into a cold medium and the corresponding formation of a thermal heat front, known as a Marshak wave, is well modeled by the thermal radiative transfer equations. They consist of a coupled system of partial differential equations governing the transport of particles (represented by the particle density $f$) and the temperature evolution of the medium ($T$) [1] given by

$$
\frac{1}{c}\partial_{t}f+\hskip 2.84526pt\boldsymbol{\Omega}\cdot\nabla_{\textbf{x}}f=\sigma^{a}(B(T)-f), \tag{1.1}
$$

$$
c_{\nu}\partial_{t}T=\int_{\mathbb{S}^{2}}\sigma^{a}(f-B(T))\hskip 2.84526pt\mathrm{d}\boldsymbol{\Omega}.
$$

The particle density $f$ depends on time $t$, position **x** and direction of flight $\boldsymbol{\Omega}\in\mathbb{S}^{2}$ and the temperature $T$ on time and position. $c$ and $c_{\nu}$ represent the speed of light and the specific heat of the material, respectively. These two equations are coupled through the absorption and emission of particles by the background material. Numerically simulating the thermal radiative transfer equations poses several challenges. First, to evolve and store the particle density, high memory, and computational resources are required. This is due to its high-dimensional phase space, consisting of temporal, spatial, and angular variables, which can be up to six-dimensional for a three-dimensional spatial domain. Second, when a large number of these particles are absorbed in small time scales, the dynamics of the system asymptotically converge to a diffusion-type non-linear partial differential equation known as the Rosseland approximation [2] which reads

$$
(c_{\nu}+4aT^{3})\partial_{t}T=\nabla_{\textbf{x}}\cdot\left(\frac{4ac}{3\sigma^{a}}T^{3}\nabla_{\textbf{x}}T\right),
$$

where $a$ is the radiation constant. Since the dynamics tend to a diffusion problem, the numerical scheme should also capture this behavior without having to resolve prohibitively small time scales. Numerical methods that do so while efficiently treating the stiffness arising from large absorption terms are called asymptotic-preserving (AP) schemes [3]. Work on asymptotic-preserving schemes for kinetic equations can, for example, be found in [3, 4, 5, 6].

To address the computational challenges posed by a high-dimensional phase space, we use dynamical low-rank approximation (DLRA) [7], which is a model-order reduction strategy that has recently gained popularity in solving kinetic equations. The fundamental idea behind dynamical low-rank approximation is to evolve the solution on the manifold of rank $r$ functions $\mathcal{M}_{r}$ by projecting the dynamics to the tangent space of $\mathcal{M}_{r}$. The evolution equations thus obtained can be interpreted as a Galerkin system, with $2r$ basis functions for the phase space variables, which evolves the coefficients and basis functions according to the dynamics of the problem. Using standard time integrators to evolve the coefficient and basis functions leads to unstable numerical schemes and thus robust integrators, like the projector-splitting integrator (PSI) [8], and the basis-update & Galerkin (BUG) integrators [9, 10, 11, 12], have been developed.

DLRA has, for example, been shown to reduce computational costs in dose computation in radiation therapy planning [13], in high-scattering problems [14] and neutron criticality problems [15]. In recent works, DLRA was used for the thermal radiative transfer equations [16, 17] where it was shown to significantly reduce computational time. The work in [17] proposes a low-rank scheme based on the augmented BUG integrator of [10] for thermal radiative transfer. Though this scheme is energy-stable and preserves mass locally, it does not include multiscale effects frequently arising in thermal radiative transfer.

Since the thermal radiative transfer equations tend to a diffusion equation, for small time scales, the dynamics are restricted to the manifold of low-rank functions [2] and thus can be accurately represented by a low-rank approximation. Thus, a DLRA scheme combined with techniques to preserve asymptotic behavior can be highly beneficial in tackling both numerical challenges simultaneously. This was investigated for the related problem of radiation transport in [18], where the PSI, along with a macro-micro decomposition to construct an asymptotic-preserving scheme, is used. A key challenge for such schemes is to prove stability and provide a CFL condition that takes into account effects at long time scales (kinetic regime) and small time scales (diffusive regime). In contrast to [18], the scheme constructed in [19] uses the fixed-rank BUG integrator and is energy stable under a CFL restriction, which captures both the kinetic and diffusive regimes. In the kinetic regime, a large number of particles stream in all directions, increasing the rank required to resolve the solution. In contrast, in the diffusive regime, a large number of streaming particles are absorbed and diffused, thus lowering the required rank of the solution [2]. This is well demonstrated in the experiments from [19, 18]. Thus, using a fixed-rank integrator without prior knowledge of the required rank in the regime results in either higher computational costs (due to over-approximation) or a poorly resolved solution (due to under-approximation). One of the ways to address this is by using a DLRA scheme that appropriately chooses and evolves the rank of the solution according to the regime.

This work proposes an asymptotic-preserving and rank-adaptive DLRA scheme for the thermal radiative transfer equations in slab geometry and analyzes its properties. The novelty of this work can be summarized in the following:

- *An asymptotic-preserving, mass conservative and rank-adaptive DLRA integrator:* We propose a new asymptotic-preserving BUG integrator for the thermal radiative transfer equations, based on the macro-micro decomposition [6, 20] of the particle density, the basis augmentation step from [10] and conservative truncation [21, 22], to capture the underlying dynamics of the system. The proposed algorithm is locally mass conservative.
- *A stability analysis for the proposed asymptotic-preserving DLRA scheme*: We show that the proposed integrator is stable in the energy norm under a CFL restriction that captures both the kinetic and the diffusive regime under linear emission of particles by the background material.

This paper is structured as follows: Following the introduction in Section 1, in Section 2 we review background concepts that are used in this paper and build the modal macro-micro equations for the thermal radiative transfer equations. In Section 3, we present a spatio-temporal discretization for the modal macro-micro equations, which is asymptotic-preserving and stable under a CFL restriction that captures the kinetic and diffusive regime. In Section 4 we present dynamical low-rank integrators for the thermal radiative transfer equations and the stability results. Specifically, in Section 4.1, we present the evolution equations for the modal macro-micro equations using the fixed-rank BUG integrator [9] and prove its stability property. In Section 4.2, we present the asymptotic-preserving BUG integrator and prove the stability of the scheme. Finally, numerical experiments are presented in Section 5.

## 2 Background

In this section, we review the basic ideas and concepts that are used in this work. The first subsection describes the thermal radiative transfer equations in slab geometry for the gray approximation, its asymptotic limit, and the macro-micro decomposition [6] of the particle density and its angular discretization. In the second subsection, we look at dynamical low-rank approximation [7], the fixed-rank BUG integrator [9] and the augmented BUG integrator [10].

### 2.1 Thermal radiative transfer equations

In this paper, we consider the dimensionless form of the gray (i.e., frequency-averaged) thermal radiative transfer equations in slab geometry,

$$
\frac{\varepsilon^{2}}{c}\partial_{t}f+\varepsilon\mu\partial_{x}f=\sigma^{a}(B(T)-f), \tag{2.1a}
$$

$$
\varepsilon^{2}c_{\nu}\partial_{t}T=\int_{-1}^{1}\sigma^{a}(f-B(T))\hskip 2.84526pt\mathrm{d}\mu. \tag{2.1b}
$$

In the above equations, $f(t,x,\mu)$ represents the particle density (or angular flux) at time $t\in\mathbb{R}^{+}$, position $x\in D\subset\mathbb{R}$ and direction of flight $\mu\in[-1,1]$. The temperature of the material is given by $T(t,x)$ and depends on time and position. These are supplemented with initial and boundary conditions, which are later specified according to the problem. $B(T)$ describes the emission of particles by the background material due to blackbody radiation at its current temperature. It is given by the Stefan-Boltzmann law,

$$
B(T)=acT^{4},
$$

where $a$ is the radiation constant and $c$ is the speed of light. The rate of absorption and emission of particles by the background material is specified by the absorption cross-section $\sigma^{a}(x)$, where we assume that $\sigma^{a}(x)\geq\sigma_{0}>0$. We denote the integral over $\mu$ as $\langle\cdot\rangle_{\mu}=\int_{-1}^{1}\cdot\hskip 2.84526pt\mathrm{d}\mu$ and thus the scalar flux of the particle density is defined as, $\phi(t,x)=\frac{1}{2}\langle f\rangle_{\mu}$.

In (2.1) as $\varepsilon$ tends to zero, absorption effects dominate the dynamics. A Hilbert expansion of the particle density $f$ yields that, as $\varepsilon\to 0$, the particles are distributed as $B(T)$, i.e., $f=B(T)$, while the evolution of temperature is given by a diffusion-type non-linear equation known as the Rosseland approximation [2]:

$$
c_{\nu}\partial_{t}T=\frac{2}{3}\partial_{x}\left(\frac{1}{\sigma^{a}}B^{\prime}(T)\partial_{x}T\right)-\frac{2}{c}B^{\prime}(T)\partial_{t}T, \tag{2.2}
$$

where $B^{\prime}(T)=\frac{d}{dT}B(T)$.

#### 2.1.1 Macro-micro decomposition

The asymptotic analysis of the thermal radiative equations (2.1) shows that multiple time scales are involved in the evolution of temperature and particles. In particular, effects occur at times scales of order $\mathcal{O}(1)$, $\mathcal{O}(\varepsilon)$, and $\mathcal{O}(\varepsilon^{2})$ and must be correctly resolved to capture the underlying dynamics of the system. One way to do this is by decomposing the particle density into variables that describe the macroscopic and microscopic effects. This type of decomposition of the particle density is called a macro-micro decomposition and was first proposed in [6]. Since the thermal radiative transfer equations involve three time scales, the particle density is decomposed into macroscopic ($B$), microscopic ($g$), and mesoscopic ($h$) variables. For the thermal radiative transfer equations, this macro-micro ansatz was first proposed in [20]. To be precise, we make the following ansatz for the particle density

$$
f(t,x,\mu)=B(T(t,x))+\varepsilon g(t,x,\mu)+\varepsilon^{2}h(t,x), \tag{2.3}
$$

where $\langle g\rangle_{\mu}=0$. Note that since $\langle g\rangle_{\mu}=0$, the total mass of the system is conserved and was used in [23] to construct a numerical scheme that conserves mass in shallow water equations.

> **Remark 1**
>
> The rationale behind calling $h$ the mesoscopic variable instead of the microscopic variable, despite scaling as $\varepsilon^{2}$ is that it arises as the leading scaled quantity in the decomposition of the macroscopic quantity of radiation transport equation, the scalar flux, and does not depend on the angular variable.

To obtain evolution equations for $h,g$ and $T$ we substitute the macro-micro ansatz (2.3) in the radiative transfer equations (2.1) yielding the following evolution equations

$$
\frac{\varepsilon^{2}}{c}\partial_{t}h+\frac{\kappa}{c}\sigma^{a}B^{\prime}(T)h+\frac{1}{2}\partial_{x}\langle\mu g\rangle_{\mu}=-\sigma^{a}h, \tag{2.4a}
$$

$$
\frac{\varepsilon^{2}}{c}\partial_{t}g+\varepsilon\left(\mathcal{I}-\frac{1}{2}\langle\cdot\rangle_{\mu}\right)(\mu\partial_{x}g)+B^{\prime}(T)\mu\partial_{x}T+\varepsilon^{2}\mu\partial_{x}h=-\sigma^{a}g, \tag{2.4b}
$$

$$
\partial_{t}T=\kappa\sigma^{a}h, \tag{2.4c}
$$

where we set $\kappa=\frac{2}{c_{\nu}}$ for ease of presentation. Note that by comparing the $\mathcal{O}(\varepsilon^{0})$ terms in all three equations of (2.4) we obtain the Rosseland approximation (2.2) [2, 20].

##### Initial and boundary conditions

It remains to describe the initial and boundary conditions for the macro-micro equations (2.4). Note that we can write the microscopic variable $g$ and mesoscopic variable $h$ as

$$
g(t,x,\mu)=\frac{1}{\varepsilon}\left(f(t,x,\mu)-\frac{1}{2}\langle f(t,x,\mu)\rangle_{\mu}\right), \tag{2.5a}
$$

$$
h(t,x)=\frac{1}{\varepsilon^{2}}\left(\frac{1}{2}\langle f(t,x,\mu)\rangle_{\mu}-B(T)(t,x)\right). \tag{2.5b}
$$

Thus, for given initial and boundary conditions of the radiative transfer equations (2.1), we use the above relations to derive the initial and boundary conditions for the macro-micro equations (2.4).

#### 2.1.2 Angular discretization of microscopic variable

The microscopic variable $g$ depends on the direction of flight, $\mu$, and must be discretized in the angular domain. In this work, we use the method of moments or the $\mathrm{P}_{N}$ method [24] to discretize in $\mu$. To obtain the moment equations, let $\{\widetilde{P}_{k}\}_{k\in\mathbb{N}\cup\{0\}}$ be orthogonal Legendre polynomials with standard $L^{2}([-1,1])$ norms $\gamma_{k}$, given by $\gamma_{k}^{2}=\frac{2}{2k+1}$. Let $P_{k}=\widetilde{P}_{k}/\gamma_{k}$ denote the $k^{\text{th}}$ orthonormal Legendre polynomial satisfying the recurrence relation

$$
\mu P_{k}=a_{k-1}P_{k-1}+a_{k}P_{k+1},\hskip 18.49988pta_{k}=\frac{k+1}{\sqrt{(2k+1)(2k+3)}}.
$$

The $\mathrm{P}_{N}$ ansatz for $g$ then reads

$$
g(t,x,\mu)\approx g_{\mathrm{P}_{N}}(t,x,\mu)=\sum_{k=0}^{N}g_{k}(t,x)P_{k}(\mu),
$$

where $g_{k}$ is called the k^{th} moment of the system. Since $P_{k}$ is orthonormal the k^{th} moment is given by $g_{k}=\langle gP_{k}\rangle_{\mu}$. To obtain evolution equations for the moments $g_{k}$, $k=0,1,\ldots,N$, we multiply (2.4b) by $P_{k}$ and integrate over $\mu\in[-1,1]$ . The evolution equation for the k${}^{\text{th}}$ moment is then given by

$$
\frac{\varepsilon^{2}}{c}\partial_{t}g_{k}+\varepsilon\partial_{x}\left(a_{k-1}g_{k-1}+a_{k}g_{k+1}\right)-\varepsilon\frac{\gamma_{0}\gamma_{1}}{2}\partial_{x}g_{1}\delta_{k0}+\gamma_{1}\left(B^{\prime}(T)\partial_{x}T+\varepsilon^{2}\partial_{x}h\right)\delta_{k1}=-\sigma^{a}g_{k}.
$$

Note that since $\langle g\rangle_{\mu}=0$, we get $g_{0}=0$ and we obtain the following system of modal macro-micro equations

$$
\frac{\varepsilon^{2}}{c}\partial_{t}h+\frac{\kappa}{c}\sigma^{a}B^{\prime}(T)h+\frac{\gamma_{1}}{2}\partial_{x}g_{1}=-\sigma^{a}h, \tag{2.6a}
$$

$$
\frac{\varepsilon^{2}}{c}\partial_{t}\textbf{{g}}+\varepsilon\textbf{A}\partial_{x}\textbf{{g}}+\textbf{{b}}\left(B^{\prime}(T)\partial_{x}T+\varepsilon^{2}\partial_{x}h\right)=-\sigma^{a}\textbf{{g}}, \tag{2.6b}
$$

$$
\partial_{t}T=\kappa\sigma^{a}h, \tag{2.6c}
$$

where

$$
\textbf{{g}}=(g_{1},\ldots,g_{N})^{\top}\in\mathbb{R}^{N},\hskip 18.49988pt\textbf{A}=\begin{bmatrix}0&a_{1}&&\\
a_{1}&0&\ddots&\\
&\ddots&\ddots&\\
&&&a_{N-1}\\
&&a_{N-1}&0\end{bmatrix}\in\mathbb{R}^{N\times N}\text{ and }\hskip 9.24994pt\textbf{{b}}=(\gamma_{1},0,\ldots,0)^{\top}\in\mathbb{R}^{N}.
$$

### 2.2 Dynamical low-rank approximation

In this subsection, we give an overview of the DLRA put forth in [7]. The fundamental motivation behind DLRA is to evolve a solution on a low-rank manifold of a given rank. To make this more concrete, let $g_{ik}=g_{k}(t,x_{i})$ be the evaluation of the k${}^{\text{th}}$ moment of the microscopic variable $g_{k}$ at spatial point $x_{i}$. The goal is then to evolve **g** such that it stays on the manifold of rank $r$ matrices, $\mathcal{M}_{r}$. In DLRA, a low-rank approximation is computed by projecting the dynamics of the problem onto the tangent space of the manifold [7].

For any matrix $\textbf{g}_{r}\in\mathcal{M}_{r}\subset\mathbb{R}^{N_{x}\times N}$ we have the factorization

$$
\textbf{g}_{r}(t)=\textbf{X}(t)\textbf{S}(t)\textbf{{V}}(t)^{\top}. \tag{2.7}
$$

This means that the solution matrix is spanned by the spatial basis $\textbf{X}:\mathbb{R}^{+}\to\mathbb{R}^{N_{x}\times r}$, the moment basis $\textbf{{V}}:\mathbb{R}^{+}\to\mathbb{R}^{N\times r}$, and the coefficient matrix $\textbf{S}:\mathbb{R}^{+}\to\mathbb{R}^{r\times r}$. In DLRA, the basis and coefficient matrices are evolved on the low-rank manifold such that, for $\textbf{g}_{r}(t)\in\mathcal{M}_{r}$ and a given right-hand side $\textbf{F}:\mathbb{R}^{N_{x}\times N}\rightarrow\mathbb{R}^{N_{x}\times N}$, the following minimization problem is satisfied at all times $t$

$$
\underset{\dot{\textbf{g}}_{r}(t)\in\mathcal{T}_{\textbf{g}_{r}(t)}\mathcal{M}_{r}}{\text{min}}\left\lVert\dot{\textbf{g}}_{r}(t)-\textbf{F}(\textbf{g}_{r}(t))\right\rVert_{F}.
$$

Here $\mathcal{T}_{\textbf{g}_{r}(t)}\mathcal{M}_{r}$ denotes the tangent space of $\mathcal{M}_{r}$ at $\textbf{g}_{r}$. A reformulation of this minimization problem [7, Lemma 4.1] projects the right-hand side onto the tangent space and requires solving

$$
\dot{\textbf{g}}_{r}(t)=\textbf{P}(\textbf{g}_{r}(t))\textbf{F}(\textbf{g}_{r}(t))
$$

where

$$
\textbf{P}(\textbf{g}_{r})\textbf{Z}=\textbf{X}\textbf{X}^{\top}\textbf{Z}-\textbf{X}\textbf{X}^{\top}\textbf{Z}\textbf{{V}}\textbf{{V}}^{\top}+\textbf{Z}\textbf{{V}}\textbf{{V}}^{\top}
$$

is the projection onto the tangent space $\mathcal{T}_{\textbf{g}_{r}(t)}\mathcal{M}_{r}$.

Following [7], evolution equations can be derived for the factorized solution from the above equations as

$$
\dot{\textbf{S}}(t)=\textbf{X}(t)^{\top}\textbf{F}(\textbf{g}_{r}(t))\textbf{{V}}(t), \tag{2.8}
$$

$$
\dot{\textbf{X}}(t)=(\textbf{I}-\textbf{X}(t)\textbf{X}(t)^{\top})\textbf{F}(\textbf{g}_{r}(t))\textbf{{V}}(t)\textbf{S}(t)^{-1},
$$

$$
\dot{\textbf{{V}}}(t)=(\textbf{I}-\textbf{{V}}(t)\textbf{{V}}(t)^{\top})\textbf{F}(\textbf{g}_{r}(t))^{\top}\textbf{X}(t)\textbf{S}(t)^{-\top}.
$$

In case of over-approximation of the rank, the coefficient matrix **S** becomes nearly singular which is a source of instabilities. Thus, robust integrators that do not invert the coefficient matrix have been developed [8, 9, 10, 11]. In this work, we use the fixed-rank BUG [9] and the augmented BUG integrator [10], which we describe here in brief.

For a given factorized initial solution, $\textbf{g}^{0}_{r}=\textbf{X}^{0}\textbf{S}^{0}\textbf{{V}}^{0,\top}$, one step of the fixed-rank BUG integrator updates the factors $\textbf{X},\textbf{S},\textbf{{V}}$ from time $t_{0}$ to $t_{1}$ by the following sub-steps

- K-step Update $\textbf{X}^{0}$ to $\textbf{X}^{1}$ by solving

  $$
  \dot{\textbf{K}}(t)=\textbf{F}(\textbf{K}(t)\textbf{{V}}^{0,\top})\textbf{{V}}^{0},\hskip 18.49988pt\textbf{K}(t_{0})=\textbf{X}^{0}\textbf{S}^{0}.
  $$

  Compute $\textbf{K}(t_{1})=\textbf{X}^{1}\textbf{S}^{K}$, e.g. by using QR decomposition, and store $\textbf{M}=\textbf{X}^{1,\top}\textbf{X}^{0}$.
- L-step Update $\textbf{{V}}^{0}$ to $\textbf{{V}}^{1}$ by solving

  $$
  \dot{\textbf{L}}(t)=\textbf{X}^{0,\top}\textbf{F}(\textbf{X}^{0}\textbf{L}(t)),\hskip 18.49988pt\textbf{L}(t_{0})=\textbf{S}^{0}\textbf{{V}}^{0,\top}.
  $$

  Compute $\textbf{L}(t_{1})^{\top}=\textbf{{V}}^{1}\textbf{S}^{L,\top}$, e.g. by using QR decomposition, and store $\textbf{N}=\textbf{{V}}^{1,\top}\textbf{{V}}^{0}$.
- S-step Update the coefficient matrix $\textbf{S}^{0}$ to $\textbf{S}^{1}$ by performing Galerkin step in the updated basis

  $$
  \dot{\textbf{S}}(t)=\textbf{X}^{1,\top}\textbf{F}(\textbf{X}^{1}\textbf{S}(t)\textbf{{V}}^{1,\top})\textbf{{V}}^{1},\hskip 18.49988pt\textbf{S}(t_{0})=\textbf{M}\textbf{S}^{0}\textbf{N}^{\top}
  $$

  and set $\textbf{S}^{1}=\textbf{S}(t_{1})$.

Then the approximation at the next time step is set as $\textbf{g}_{r}(t_{1})=\textbf{X}^{1}\textbf{S}^{1}\textbf{{V}}^{1,\top}$.

Using a fixed-rank integrator comes with several challenges. First, since the rank of the solution is not known beforehand, it is usually over-approximated, which leads to increased computational costs. Second, the rank of the solution may vary over time [10, 13, 17]; thus, a fixed-rank integrator may not capture the solution correctly. Moreover, the fixed-rank BUG integrator does not preserve solution invariances. To overcome these, a rank-adaptive extension of the fixed-rank BUG integrator, known as the augmented BUG integrator, was presented in [10] that appends extra spatial and angular basis vectors by reusing the old basis and truncates the rank to a prescribed tolerance $\vartheta$.

To present the algorithm, we denote all quantities of rank $2r$ with hats and those of rank $r$ without. Then, one step of the augmented BUG integrator updates the solution, $\textbf{g}^{0}_{r}=\textbf{X}^{0}\textbf{S}^{0}\textbf{{V}}^{0,\top}$ of rank $r$ (note that $\textbf{g}_{r}$ represents low-rank approximation and not an approximation of rank $r$), from time $t_{0}$ to $t_{1}$ through the following steps

1. Update and expand the spatial and angular basis in parallel.

   - K-step Solve

     $$
     \dot{\textbf{K}}(t)=\textbf{F}(\textbf{K}(t)\textbf{{V}}^{0,\top})\textbf{{V}}^{0},\hskip 18.49988pt\textbf{K}(t_{0})=\textbf{X}^{0}\textbf{S}^{0},
     $$

     and compute the updated basis matrix $\widehat{\textbf{X}}\in\mathbb{R}^{N_{x}\times 2r}$ as an orthonormal basis of $\left[\textbf{K}(t_{1}),\textbf{X}^{0}\right]$ and store $\widehat{\textbf{M}}=\widehat{\textbf{X}}^{\top}\textbf{X}^{0}\in\mathbb{R}^{2r\times r}$.
   - L-step Solve

     $$
     \dot{\textbf{L}}(t)=\textbf{X}^{0,\top}\textbf{F}(\textbf{X}^{0}\textbf{L}(t)),\hskip 18.49988pt\textbf{L}(t_{0})=\textbf{S}^{0}\textbf{{V}}^{0,\top},
     $$

     and compute the updated basis matrix $\widehat{\textbf{{V}}}\in\mathbb{R}^{\mathbb{N}\times 2r}$ as an orthonormal basis of $\left[\textbf{L}(t_{1})^{\top},\textbf{{V}}^{0}\right]$ and store $\widehat{\textbf{N}}=\widehat{\textbf{{V}}}^{\top}\textbf{{V}}^{0}\in\mathbb{R}^{2r\times r}$.
2. Update the coefficient matrix $\textbf{S}^{0}$ to $\widehat{\textbf{S}}$ by performing Galerkin step in the updated and expanded basis

   $$
   \dot{\widehat{\textbf{S}}}(t)=\widehat{\textbf{X}}^{1,\top}\textbf{F}(\widehat{\textbf{X}}\widehat{\textbf{S}}(t)\widehat{\textbf{{V}}}^{\top})\widehat{\textbf{{V}}},\hskip 18.49988pt\widehat{\textbf{S}}(t_{0})=\widehat{\textbf{M}}\textbf{S}^{0}\widehat{\textbf{N}}^{\top}.
   $$
3. Truncation to new rank $r_{1}$. Compute the SVD decomposition of $\widehat{\textbf{S}}$

   $$
   \widehat{\textbf{S}}=\textbf{P}\boldsymbol{\Sigma}\textbf{Q}^{\top},
   $$

   where $\textbf{P},\textbf{Q}\in\mathbb{R}^{2r\times 2r}$ are orthogonal matrices and $\boldsymbol{\Sigma}\in\mathbb{R}^{2r\times 2r}$ is a diagonal matrix with singular values, $\hat{\sigma}_{1},\ldots,\hat{\sigma}_{2r}$. The new rank $r_{1}$ is chosen as $1\leq r_{1}\leq 2r$ such that, for some user-defined $\vartheta$, the following is satisfied:

   $$
   \left(\sum_{i=r_{1}+1}^{2r}\hat{\sigma}_{i}^{2}\right)^{1/2}\leq\vartheta.
   $$

   To set the updated factors, we define $\textbf{P}_{r_{1}}$ and $\textbf{Q}_{r_{1}}$ to be the matrices containing the first $r_{1}$ columns of **P** and **Q**, respectively. $\boldsymbol{\Sigma}_{r_{1}\times r_{1}}$ is set as the diagonal matrix containing the first $r_{1}$ singular values of $\widehat{\textbf{S}}$. Then the updated factors are set as $\textbf{X}^{1}=\widehat{\textbf{X}}\textbf{P}_{r_{1}}$, $\textbf{{V}}^{1}=\widehat{\textbf{{V}}}\textbf{Q}_{r_{1}}$ and $\textbf{S}^{1}=\boldsymbol{\Sigma}_{r_{1}\times r_{1}}$ and, the approximation at time $t_{1}$ is then $\textbf{g}^{1}_{r}=\textbf{X}^{1}\textbf{S}^{1}\textbf{{V}}^{1,\top}$.

> **Remark 2**
>
> Note that often in practice, to truncate the rank, a relative tolerance of the form $\vartheta\cdot\left\lVert\boldsymbol{\Sigma}\right\rVert_{2}$ is used.

## 3 Energy stability of modal macro-micro equations

Having discretized the macro-micro equations in angle (2.6), in this section, we present an asymptotic-preserving spatio-temporal discretization and investigate its energy stability.

### 3.1 Spatio-temporal discretization

We start by noting that for $i,j\in\{1,\ldots,N\}$, we can represent the $(i,j)^{\text{th}}$ term of the flux matrix **A** by a quadrature rule. That is,

$$
\mathrm{A}_{ij}=\langle\mu P_{i}P_{j}\rangle_{\mu}=\int_{-1}^{1}\mu P_{i}(\mu)P_{j}(\mu)\hskip 2.84526pt\mathrm{d}\mu\approx\sum_{k=1}^{N+1}w_{k}\mu_{k}P_{i}(\mu_{k})P_{j}(\mu_{k}),
$$

where $(\mu_{k})_{k=1,\ldots,N+1}$ and $(w_{k})_{k=1,\ldots,N+1}$ are quadrature points and weights given by the Gauss-Legendre quadrature rule. If we define the matrices $\textbf{T}\in\mathbb{R}^{N\times(N+1)}$, with $T_{ik}=\sqrt{w_{k}}P_{i}(\mu_{k})$, and $\textbf{M}\in\mathbb{R}^{(N+1)\times(N+1)}$, with $\mathrm{M}_{ij}=\mu_{i}\delta_{ij}$, then we can write the flux matrix as $\textbf{A}=\textbf{T}\textbf{M}\textbf{T}^{\top}$. Given $(\left\lvert\textbf{M}\right\rvert)_{ij}=\left\lvert\mathrm{M}_{ij}\right\rvert$ we can define a stabilization matrix for a finite volume discretization as $\left\lvert\textbf{A}\right\rvert=\textbf{T}\left\lvert\textbf{M}\right\rvert\textbf{T}^{\top}$ and $\textbf{A}^{\pm}=\frac{1}{2}\textbf{T}(\textbf{M}\pm\left\lvert\textbf{M}\right\rvert)\textbf{T}^{\top}$.

> **Remark 3**
>
> The choice of the stabilization matrix used here is not the standard Roe matrix $\widetilde{\textbf{T}}\left\lvert\widetilde{\textbf{M}}\right\rvert\widetilde{\textbf{T}}^{\top}$ where $\textbf{A}=\widetilde{\textbf{T}}\widetilde{\textbf{M}}\widetilde{\textbf{T}}^{\top}$ is the eigendecomposition of the flux matrix. That is, the columns of $\widetilde{\textbf{T}}\in\mathbb{R}^{N\times N}$ consist of orthogonal eigenvectors of **A** and $\widetilde{\textbf{M}}\in\mathbb{R}^{N\times N}$ has the corresponding eigenvalues on the diagonal. The factorization of the flux matrix used, consisting of transformation matrices in $\mathbb{R}^{N\times(N+1)}$, is needed for the diagonalization of the modal scheme for showing stability in the energy norm. This choice of stabilization matrix was first presented in [19] for the radiative transport equation.

We discretize in space using an equidistant staggered grid, with $\Delta x=1/N_{x}$, for a given number of $N_{x}\in\mathbb{N}$ spatial cells. The cell interfaces are given by $x_{1/2},\ldots,x_{N_{x}+1/2}$ and the midpoints by $x_{i}$ for $i\in\{1,\ldots,N_{x}\}$. The temperature ($T$) and mesoscopic variable ($h$) are resolved at the full grid points $x_{i}$ whereas the microscopic variable (**g**) is evaluated at the cell interfaces $x_{i+1/2}$. Since $B(T)=acT^{4}$ we get $B^{\prime}(T)=4acT^{3}$ and thus, to simplify the presentation of the algorithm, we define

$$
\Psi(t,x)=4(T(t,x))^{3}.
$$

The values of $\Psi$ at $x_{i}$ and $x_{i+1/2}$ are given by $\Psi^{n}_{i}=\Psi(t^{n},x_{i})$ and $\Psi^{n}_{i+1/2}=\frac{\Psi^{n}_{i+1}+\Psi^{n}_{i}}{2}$, respectively. Finally, to discretize in time we employ a forward-backward Euler scheme and obtain the following modal macro-micro scheme

$$
\frac{\varepsilon^{2}}{c}\left(\frac{h^{n+1}_{i}-h^{n}_{i}}{\Delta t}\right)+a\kappa\hskip 1.42262pt\sigma^{a}_{i}\Psi^{n}_{i}h^{n+1}_{i}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}=-\sigma^{a}_{i}h^{n+1}_{i}, \tag{3.1a}
$$

$$
\frac{\varepsilon^{2}}{c}\left(\frac{\textbf{{g}}^{n+1}_{i+1/2}-\textbf{{g}}^{n}_{i+1/2}}{\Delta t}\right)+\varepsilon\mathcal{L}\textbf{{g}}^{n}_{i+1/2}+\textbf{{b}}\delta^{0}\left(ac\hskip 1.42262pt\Psi^{n}_{i+1/2}T^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2}\right)=-\sigma^{a}_{i+1/2}\textbf{{g}}^{n+1}_{i+1/2}, \tag{3.1b}
$$

$$
\frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}=\kappa\hskip 1.42262pt\sigma^{a}_{i}h^{n+1}_{i}, \tag{3.1c}
$$

where,

$$
\displaystyle\mathcal{D}^{-}\textbf{{g}}_{i+1/2} \displaystyle=\frac{\textbf{{g}}_{i+1/2}-\textbf{{g}}_{i-1/2}}{\Delta x}, \displaystyle\hskip 18.49988pt\mathcal{D}^{+}\textbf{{g}}_{i+1/2} \displaystyle=\frac{\textbf{{g}}_{i+3/2}-\textbf{{g}}_{i+1/2}}{\Delta x},
$$

$$
\displaystyle\mathcal{D}^{0}\textbf{{g}}_{i} \displaystyle=\frac{\textbf{{g}}_{i+1/2}-\textbf{{g}}_{i-1/2}}{\Delta x}(=\mathcal{D}^{-}\textbf{{g}}_{i+1/2}), \displaystyle\hskip 18.49988pt\delta^{0}T_{i+1/2} \displaystyle=\frac{T_{i+1}-T_{i}}{\Delta x},
$$

$$
\displaystyle\mathcal{L}\textbf{{g}}_{i+1/2} \displaystyle=(\textbf{A}^{+}\mathcal{D}^{-}+\textbf{A}^{-}\mathcal{D}^{+})\textbf{{g}}_{i+1/2}.
$$

> **Theorem 1**
>
> *In the limit $\varepsilon\to 0$, the modal macro-micro scheme (3.1) gives a consistent discretization of the diffusion equation*
>
> $$
> (1+\frac{2a\Psi}{c_{\nu}})\partial_{t}T=\frac{2ac}{3c_{\nu}}\partial_{x}\left(\frac{1}{\sigma^{a}}\Psi\partial_{x}T\right).
> $$

> **Proof**
>
> The $\mathcal{O}(\varepsilon^{0})$ term in (3.1b) is given by
>
> $$
> -\sigma^{a}_{i+1/2}g_{1,i+1/2}^{n+1}=\gamma_{1}ac\Psi^{n}_{i+1/2}\delta^{0}T^{n}_{i+1/2}. \tag{3.2}
> $$
>
> Similarly, the $\mathcal{O}(\varepsilon^{0})$ term in (3.1a) is
>
> $$
> -\sigma^{a}_{i}h^{n+1}_{i}=a\kappa\hskip 1.42262pt\sigma^{a}_{i}\Psi^{n}_{i}h^{n+1}_{i}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}
> $$
>
> which on substituting $g_{1,i+1/2}^{n+1}$ from (3.2) and collecting $h_{i}^{n+1}$ terms on the left hand side yields
>
> $$
> (1+a\kappa\Psi^{n}_{i})\sigma^{a}_{i}h_{i}^{n+1}=\frac{\gamma_{1}^{2}}{2}ac\left[\dfrac{\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}(T^{n}_{i+1}-T^{n}_{i})-\frac{\Psi^{n}_{i-1/2}}{\sigma^{a}_{i-1/2}}(T^{n}_{i}-T^{n}_{i-1})}{(\Delta x)^{2}}\right].
> $$
>
> Thus, substituting $\sigma^{a}_{i}h^{n+1}_{i}$ in (3.1c)
>
> $$
> (1+\frac{2a\Psi^{n}_{i}}{c_{\nu}})\left(\frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}\right)=\frac{2ac}{3c_{\nu}}\left[\dfrac{\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}(T^{n}_{i+1}-T^{n}_{i})-\frac{\Psi^{n}_{i-1/2}}{\sigma^{a}_{i-1/2}}(T^{n}_{i}-T^{n}_{i-1})}{(\Delta x)^{2}}\right],
> $$
>
> where we re-substitute $\kappa=\frac{2}{c_{\nu}}$. This is a discretization of the limiting diffusion equation with an explicit Euler discretization in time and centered differences for spatial derivatives.
>
> ∎

### 3.2 Stability analysis

Next, we investigate the stability of the modal macro-micro scheme (3.1) in energy norm for a linearized version of the problem as described in [25]. The linearization assumes that the particles are emitted from the background material proportional to the temperature (instead of the 4^{th} power of temperature as given by the Stefan-Boltzmann law). That is, we set $B(T)=acT$ and thus $\Psi=1$. Other strategies to linearize the problem include the Su-Olsen closure [26] in which the specific heat, $c_{\nu}$, is assumed to be proportional to $T^{3}$.

Substituting the value of $\Psi$ in (3.1) we get the following modal macro-micro scheme with linear emission of particles:

$$
\frac{\varepsilon^{2}}{c}\left(\frac{h^{n+1}_{i}-h^{n}_{i}}{\Delta t}\right)+a\kappa\hskip 1.42262pt\sigma^{a}_{i}h^{n+1}_{i}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}=-\sigma^{a}_{i}h^{n+1}_{i}, \tag{3.3a}
$$

$$
\frac{\varepsilon^{2}}{c}\left(\frac{\textbf{{g}}^{n+1}_{i+1/2}-\textbf{{g}}^{n}_{i+1/2}}{\Delta t}\right)+\varepsilon\mathcal{L}\textbf{{g}}^{n}_{i+1/2}+\textbf{{b}}\delta^{0}\left(ac\hskip 1.42262ptT^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2}\right)=-\sigma^{a}_{i+1/2}\textbf{{g}}^{n+1}_{i+1/2}, \tag{3.3b}
$$

$$
\frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}=\kappa\hskip 1.42262pt\sigma^{a}_{i}h^{n+1}_{i}. \tag{3.3c}
$$

The following norms are defined for the scalar- and vector-valued functions

$$
\left\lVert u\right\rVert^{2}=\sum_{i}u_{i}^{2}\Delta x,\hskip 18.49988pt\left\lVert\boldsymbol{\phi}\right\rVert^{2}=\sum_{i}(\boldsymbol{\phi}_{i+1/2}^{\top}\boldsymbol{\phi}_{i+1/2})\Delta x.
$$

Then, for the linearized modal macro-micro scheme, we have the following stability result:

> **Theorem 2**
>
> *Assume that the time step $\Delta t$ fulfills the CFL condition for all $k$, such that $\mu_{k}\neq 0$,*
>
> $$
> \Delta t\leq\frac{1}{5c\beta_{N}}\left(\frac{2\varepsilon\Delta x}{\left\lvert\mu_{k}\right\rvert}+\frac{\sigma_{0}\Delta x^{2}}{\mu_{k}^{2}}\right), \tag{3.4}
> $$
>
> *where $\beta_{N}=\underset{k}{\mathrm{max}}\hskip 5.69054ptw_{k}(N+1)$ and $c$ is the speed of light. Then, the scheme (3.3) is energy stable, that is,*
>
> $$
> e^{n+1}\leq e^{n},
> $$
>
> *where the energy is defined as*
>
> $$
> e^{n}=\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}+\left\lVert\sqrt{\frac{ac_{\nu}}{2}}T^{n}\right\rVert^{2}.
> $$

> **Remark 4**
>
> For the sake of compactness, the proof of this theorem, along with all the required lemmas, are presented in Appendix A. The proof follows the energy stability result in [25] and combines it with the results obtained for the modal macro-micro scheme for radiation transport from [19]. It is roughly divided into three parts; the first part bounds $\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}\right\rVert^{2}$ from above using (3.3a) and (3.3b). In the second part we derive an upper bound for $\left\lVert\sqrt{\frac{ac_{\nu}}{2}}T^{n+1}\right\rVert^{2}$ from (3.3c). Combining the bounds obtained in the first and the second part, we show energy stability subject to step size restriction given by the CFL condition (3.4) in the third part of the proof.

## 4 Dynamical low-rank approximation for the modal macro-micro equations

The macro-micro decomposition [6, 20] allows us to construct an asymptotic-preserving and energy-stable numerical algorithm for the thermal radiative transfer equations. However, the microscopic variable $g$ is still a high-dimensional quantity since it depends on time, space, and direction of flight. Thus, to reduce computational costs, we use dynamical low-rank approximation [7] to approximate the solution of $g$ by a low-rank factorization. This section is divided into two subsections; in the first subsection, we derive evolution equations for the low-rank factorization of $g$ for the fixed-rank BUG integrator [9]. We present an asymptotic-preserving spatio-temporal discretization and show that the numerical scheme is energy stable for the linearization presented in Section 3. In the second subsection, we extend the scheme to the augmented BUG integrator [10].

Consider the microscopic equation (2.6b) given by

$$
\frac{\varepsilon^{2}}{c}\partial_{t}\textbf{{g}}+\varepsilon\textbf{A}\partial_{x}\textbf{{g}}+\textbf{{b}}\left(ac\Psi\hskip 1.42262pt\partial_{x}T+\varepsilon^{2}\partial_{x}h\right)=-\sigma^{a}\textbf{{g}}. \tag{4.1}
$$

The low-rank ansatz for the microscopic variable **g** reads:

$$
\textbf{{g}}(t,x)\approx\sum_{p,q=1}^{r}X_{p}(t,x)S_{pq}(t)\textbf{V}_{q}(t)^{\top},
$$

where $r\in\mathbb{N}$ is some given rank and $\textbf{V}_{q}=(V_{1,q},\ldots,V_{N,q})^{\top}\in\mathbb{R}^{N}$. Thus, we can write the above sum as

$$
\textbf{{g}}(t,x)=\textbf{{X}}(t,x)^{\top}\textbf{S}(t)\textbf{{V}}(t)^{\top},
$$

where

$$
\textbf{{X}}=\left(X_{1},\ldots,X_{r}\right)^{\top}\in\mathbb{R}^{r},\hskip 9.24994pt\textbf{S}=\left(S_{pq}\right)_{p,q=1}^{r}\in\mathbb{R}^{r\times r},\hskip 9.24994pt\textbf{{V}}=\begin{bmatrix}\textbf{V}_{1}&\ldots&\textbf{V}_{r}\end{bmatrix}\in\mathbb{R}^{N\times r}.
$$

### 4.1 Fixed-rank modal macro-micro BUG integrator

With this low-rank ansatz for **g** we can now write down the individual steps of the fixed-rank BUG integrator [9] for updating the microscopic variable. To this end let the solution at time $t_{n}$ be given by $\textbf{{g}}^{n}(x)=\textbf{{X}}^{n}(x)^{\top}\textbf{S}^{n}\textbf{{V}}^{n,\top}$, then the evolution equations for updating $\textbf{{X}},\textbf{S},\textbf{{V}}$ are as follows:

- K-step For $\textbf{{K}}(t,x)^{\top}=\textbf{{X}}(t,x)^{\top}\textbf{S}(t)$ solve

  $$
  \frac{\varepsilon^{2}}{c}\partial_{t}\textbf{{K}}(t,x)=-\varepsilon\left[\textbf{{V}}^{n,\top}\textbf{A}\textbf{{V}}^{n}\right]\partial_{x}\textbf{{K}}(t,x)-\textbf{{V}}^{n,\top}\textbf{{b}}(ac\Psi\partial_{x}T+\varepsilon^{2}\partial_{x}h)-\sigma^{a}\textbf{{K}}(t,x),
  $$

  with the initial condition $\textbf{{K}}(t_{n},x)=\textbf{{X}}^{n}(x)^{\top}\textbf{S}^{n}$. We denote the updated spatial basis vectors by $\textbf{{X}}^{n+1}(x)$ which is obtained as the orthonormal basis of $\textbf{{K}}(t_{n+1},x)$.
- L-step For $\textbf{L}(t)=\textbf{{V}}(t)\textbf{S}(t)^{\top}$ solve

  $$
  \frac{\varepsilon^{2}}{c}\dot{\textbf{L}}(t)=-\varepsilon\textbf{A}^{\top}\textbf{L}(t)\langle\partial_{x}\textbf{{X}}^{n},\textbf{{X}}^{n,\top}\rangle_{x}-\textbf{{b}}\langle ac\Psi\partial_{x}T+\varepsilon^{2}\partial_{x}h,\textbf{{X}}^{n,\top}\rangle_{x}.
  $$

  where $\langle\cdot,\cdot\rangle_{x}$ denotes the $L^{2}$ - inner product over the spatial domain, and we have the initial condition given by $\textbf{L}(t_{n})=\textbf{{V}}^{n}\textbf{S}^{n,\top}$. We denote the updated angular basis matrix by $\textbf{{V}}^{n+1}$, which is obtained as the orthonormal basis of $\textbf{L}(t_{n+1})$.
- S-step Perform a Galerkin step in the updated spatial and angular basis according to

  $$
  \displaystyle\frac{\varepsilon^{2}}{c}\dot{\textbf{S}}(t) \displaystyle=-\varepsilon\langle\textbf{{X}}^{n+1},\partial_{x}\textbf{{X}}^{n+1,\top}\rangle_{x}\textbf{S}(t)\textbf{{V}}^{n+1,\top}\textbf{A}\textbf{{V}}^{n+1}-\langle\textbf{{X}}^{n+1},ac\Psi\partial_{x}T+\varepsilon^{2}\partial_{x}h\rangle_{x}\textbf{{b}}^{\top}\textbf{{V}}^{n+1}
  $$

  $$
  \displaystyle-\langle\sigma^{a}\textbf{{X}}^{n+1},\textbf{{X}}^{n+1,\top}\rangle_{x}\textbf{S}(t),
  $$

  with the initial condition $\textbf{S}(t_{n})=\langle\textbf{{X}}^{n+1},\textbf{{X}}^{n,\top}\rangle_{x}\textbf{S}^{n}\textbf{{V}}^{n,\top}\textbf{{V}}^{n+1}$.

#### 4.1.1 Spatio-temporal discretization

The update equations for $T$ and $h$ from Section 2.1.2 along with the evolution equations for the low-rank factors of **g** give the fixed-rank modal macro-micro BUG equations for the thermal radiative transfer equations. Similar to Section 3, we discretize the fixed-rank modal macro-micro BUG equations in space and time. First, we define

$$
\textbf{{X}}^{n}_{i+1/2}=\frac{1}{\Delta x}\int_{x_{i}}^{x_{i+1}}\textbf{{X}}(t_{n},x)\hskip 2.84526pt\mathrm{d}x
$$

and $\textbf{{K}}_{i+1/2}(t)=\textbf{{X}}_{i+1/2}(t)^{\top}\textbf{S}(t)\in\mathbb{R}^{r}$. Then, for the prescribed data $\textbf{{X}}^{n},\textbf{{V}}^{n},\textbf{S}^{n},h^{n},T^{n}$ at time $t_{n}$ the fixed-rank modal macro-micro BUG scheme updates the solution at time $t_{n}$ through the following steps,

- K-step Update

  $$
  \frac{\varepsilon^{2}}{c}\left[\frac{\textbf{{K}}^{n+1}_{i+1/2}-\textbf{{K}}^{n}_{i+1/2}}{\Delta t}\right]=-\varepsilon\mathcal{L}_{K}\textbf{{K}}^{n}_{i+1/2}-\textbf{{V}}^{n,\top}\textbf{{b}}\delta^{0}(ac\Psi^{n}_{i+1/2}T^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2})-\sigma^{a}_{i+1/2}\textbf{{K}}^{n+1}_{i+1/2}, \tag{4.2}
  $$

  where $\textbf{{K}}^{n,\top}_{i+1/2}=\textbf{{X}}^{n,\top}_{i+1/2}\textbf{S}^{n}$ and

  $$
  \mathcal{L}_{K}\textbf{{K}}^{n}_{i+1/2}=\left[\textbf{{V}}^{n,\top}\textbf{A}^{+}\textbf{{V}}^{n}\right]\mathcal{D}^{-}\textbf{{K}}^{n}_{i+1/2}+\left[\textbf{{V}}^{n,\top}\textbf{A}^{-}\textbf{{V}}^{n}\right]\mathcal{D}^{+}\textbf{{K}}^{n}_{i+1/2}.
  $$

  Compute $\textbf{{X}}^{n+1}_{i+1/2}$ as the orthonormal basis of $\textbf{{K}}^{n+1}_{i+1/2}$.
- L-step Update

  $$
  \displaystyle\frac{\varepsilon^{2}}{c}\left[\frac{\textbf{L}^{n+1}-\textbf{L}^{n}}{\Delta t}\right] \displaystyle=-\varepsilon\mathcal{L}_{L}\textbf{L}^{n}-\textbf{{b}}\sum_{i}\textbf{{X}}^{n,\top}_{i+1/2}\delta^{0}(ac\Psi^{n}_{i+1/2}T^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2}) \tag{4.3}
  $$

  $$
  \displaystyle-\textbf{L}^{n+1}\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n}_{i+1/2}\textbf{{X}}^{n,\top}_{i+1/2}
  $$

  where $\textbf{L}^{n}=\textbf{{V}}^{n}\textbf{S}^{n,\top}$ and

  $$
  \mathcal{L}_{L}\textbf{L}^{n}=\textbf{A}^{+}\textbf{L}^{n}\sum_{i}\mathcal{D}^{-}\textbf{{X}}^{n}_{i+1/2}\textbf{{X}}^{n,\top}_{i+1/2}+\textbf{A}^{-}\textbf{L}^{n}\sum_{i}\mathcal{D}^{+}\textbf{{X}}^{n}_{i+1/2}\textbf{{X}}^{n,\top}_{i+1/2}.
  $$

  Compute $\textbf{{V}}^{n+1}$ as the orthonormal basis of $\textbf{L}^{n+1}$.
- S-step Update

  $$
  \displaystyle\frac{\varepsilon^{2}}{c}\left[\frac{\textbf{S}^{n+1}-\widetilde{\textbf{S}}^{n}}{\Delta t}\right] \displaystyle=-\varepsilon\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}-\sum_{i}\textbf{{X}}^{n+1}_{i+1/2}\delta^{0}(ac\Psi^{n}_{i+1/2}T^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2})\textbf{{b}}^{\top}\textbf{{V}}^{n+1} \tag{4.4}
  $$

  $$
  \displaystyle-\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n+1}_{i+1/2}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n+1}
  $$

  where $\widetilde{\textbf{S}}^{n}=\sum_{j}\textbf{{X}}^{n+1}_{j+1/2}\textbf{{X}}^{n,\top}_{j+1/2}\textbf{S}^{n}\textbf{{V}}^{n,\top}\textbf{{V}}^{n+1}$ and

  $$
  \displaystyle\mathcal{L}_{S}\textbf{S}^{n} \displaystyle=\sum_{i}\textbf{{X}}^{n+1}_{i+1/2}\mathcal{D}^{-}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n}\textbf{{V}}^{n+1,\top}\textbf{A}^{+}\textbf{{V}}^{n+1}
  $$

  $$
  \displaystyle+\sum_{i}\textbf{{X}}^{n+1}_{i+1/2}\mathcal{D}^{+}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n}\textbf{{V}}^{n+1,\top}\textbf{A}^{-}\textbf{{V}}^{n+1},
  $$
- Update $T,h$:

  $$
  \frac{\varepsilon^{2}}{c}\left(\frac{h^{n+1}_{i}-h^{n}_{i}}{\Delta t}\right)+a\kappa\hskip 1.42262pt\sigma^{a}_{i}\Psi^{n}_{i}h^{n+1}_{i}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}\textbf{{e}}_{1}=-\sigma^{a}_{i}h^{n+1}_{i}, \tag{4.5}
  $$

  $$
  \frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}=\kappa\hskip 1.42262pt\sigma^{a}_{i}h^{n+1}_{i}. \tag{4.6}
  $$

> **Theorem 3**
>
> *In the limit $\varepsilon\to 0$, the fixed-rank modal macro-micro BUG scheme given by eqs. 4.2, 4.3, 4.4, 4.5 and 4.6 gives a consistent discretization of the diffusion equation*
>
> $$
> \left(1+\frac{2a\Psi}{c_{\nu}}\right)\partial_{t}T=\frac{2ac}{3c_{\nu}}\partial_{x}\left(\frac{1}{\sigma^{a}}\partial_{x}T\right).
> $$

> **Proof**
>
> As $\varepsilon\to 0$, from the K-step (4.2) and L-step (4.3) we obtain
>
> $$
> \textbf{{V}}^{n,\top}\textbf{{b}}\Psi^{n}_{i+1/2}\delta^{0}(acT^{n}_{i+1/2})=-\sigma^{a}_{i+1/2}\textbf{{K}}^{n+1}_{i+1/2}
> $$
>
> and
>
> $$
> \textbf{L}^{n+1}\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n}_{i+1/2}\textbf{{X}}^{n,\top}_{i+1/2}=-\textbf{{b}}\sum_{i}\textbf{{X}}^{n,\top}_{i+1/2}\Psi^{n}_{i+1/2}\delta^{0}(acT^{n}_{i+1/2}).
> $$
>
> If $\textbf{{K}}^{n+1}_{i+1/2}$ is factorized as $\textbf{{K}}^{n+1,\top}_{i+1/2}=\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}_{K}$ then $\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})$ lies in the range space of $\textbf{{X}}^{n+1}_{i+1/2}$. Similarly, if $\textbf{L}^{n+1}=\textbf{{V}}^{n+1}\textbf{S}_{L}^{\top}$ and $\left(\textbf{S}_{L}^{\top}\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n}_{i+1/2}\textbf{{X}}^{n,\top}_{i+1/2}\right)$ is invertible, then **b** lies in the range space of $\textbf{{V}}^{n+1}$.
>
> Now as $\varepsilon\to 0$, from the S-step we obtain
>
> $$
> -\left(\sum_{i}\Psi^{n}_{i+1/2}\delta^{0}(acT^{n}_{i+1/2})\textbf{{X}}^{n+1}_{i+1/2}\right)\left(\textbf{{b}}^{\top}\textbf{{V}}^{n+1}\right)=\left(\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n+1}_{i+1/2}\textbf{{X}}^{n+1,\top}_{i+1/2}\right)\textbf{S}^{n+1}. \tag{4.7}
> $$
>
> Note that since $\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})=\left[\sum_{j}\frac{\Psi^{n}_{j+1/2}}{\sigma^{a}_{j+1/2}}\delta^{0}(acT^{n}_{j+1/2})\textbf{{X}}^{n+1,\top}_{j+1/2}\right]\textbf{{X}}^{n+1}_{i+1/2}$ we have
>
> $$
> \displaystyle\sum_{i}\delta^{0}(ac\Psi^{n}_{i+1/2}T^{n}_{i+1/2})\textbf{{X}}^{n+1}_{i+1/2} \displaystyle=\sum_{i}\sigma^{a}_{i+1/2}\left(\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})\textbf{{X}}^{n+1}_{i+1/2}\right)
> $$
>
> $$
> \displaystyle=\left(\sum_{i}\sigma^{a}_{i+1/2}\textbf{{X}}^{n+1}_{i+1/2}\textbf{{X}}^{n+1,\top}_{i+1/2}\right)\left(\sum_{j}\frac{\Psi^{n}_{j+1/2}}{\sigma^{a}_{j+1/2}}\delta^{0}(acT^{n}_{j+1/2})\textbf{{X}}^{n+1}_{j+1/2}\right).
> $$
>
> Hence, (4.7) becomes
>
> $$
> \textbf{S}^{n+1}=-\left(\sum_{j}\frac{\Psi^{n}_{j+1/2}}{\sigma^{a}_{j+1/2}}\delta^{0}(acT^{n}_{j+1/2})\textbf{{X}}^{n+1}_{j+1/2}\right)\left(\textbf{{b}}^{\top}\textbf{{V}}^{n+1}\right)
> $$
>
> and since $\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})$ and **b** lie in the range of the updated spatial and angular basis, scalar multiplication with $\textbf{{X}}^{n+1,\top}_{i+1/2}$ and $\textbf{{V}}^{n+1,\top}$ from the left and right implies
>
> $$
> \textbf{{g}}^{n+1}_{i+1/2}=-\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})\textbf{{b}}^{\top}. \tag{4.8}
> $$
>
> The rest of the proof follows along the lines of Theorem 1. ∎

#### 4.1.2 Energy stability

Next, we investigate the stability of the fixed-rank modal macro-micro BUG scheme in energy norm for the linearized problem (3.3). For the following decomposition of the micro variable

$$
\textbf{g}^{n}=\begin{bmatrix}\textbf{{g}}^{n}_{1/2}\\
\vdots\\
\textbf{{g}}^{n}_{N_{x}+1/2}\end{bmatrix}=\textbf{X}^{n}\textbf{S}^{n}\textbf{{V}}^{n,\top},
$$

the norm is defined as

$$
\left\lVert\textbf{g}^{n}\right\rVert^{2}=\left\lVert\textbf{X}^{n}\textbf{S}^{n}\textbf{{V}}^{n,\top}\right\rVert^{2}_{F}\Delta x
$$

Additionally, we state the following property that we use in the proof of energy stability:

> **Property 1**
>
> *For any $\{c_{i}\}_{i=1,\ldots,N_{x}}\in\mathbb{R}$ and $\{d_{i}\}_{i=1,\ldots,N_{x}}\in\mathbb{R}$ we have*
>
> $$
> \sum_{i}c_{i}d_{i}=\frac{1}{2}\sum_{i}c^{2}_{i}+\frac{1}{2}\sum_{i}d^{2}_{i}-\frac{1}{2}\sum_{i}(c_{i}-d_{i})^{2}.
> $$

> **Theorem 4**
>
> *Assume that the time step $\Delta t$ fulfills the CFL condition (3.4) from Theorem 2. Then, the fixed-rank modal macro-micro BUG scheme given by eqs. 4.2, 4.3, 4.4, 4.5 and 4.6 is energy stable for the linearised problem (3.3), that is,*
>
> $$
> e^{n+1}\leq e^{n},
> $$
>
> *where the energy is defined as*
>
> $$
> e^{n}=\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}{\textbf{X}^{n}\textbf{S}^{n}\textbf{{V}}^{n,\top}}\right\rVert^{2}+\left\lVert\sqrt{\frac{ac_{\nu}}{2}}T^{n}\right\rVert^{2}.
> $$

> **Proof**
>
> Since the proof of the theorem follows along the lines of Theorem 2, to shorten the presentation, we only present the parts of the proof that differ from Theorem 2. That is, we show that the inequalities (A.6) and (A.5) hold for the low-rank scheme. We begin by rewriting the S-step (4.4) of the fixed-rank modal macro-micro BUG scheme as
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\textbf{S}^{n+1} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{\textbf{S}}^{n}-\varepsilon\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}-\sum_{j}\textbf{{X}}^{n+1}_{j+1/2}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\textbf{{V}}^{n+1}
> $$
>
> $$
> \displaystyle-\sum_{j}\sigma^{a}_{j+1/2}\textbf{{X}}^{n+1}_{j+1/2}\textbf{{X}}^{n+1,\top}_{j+1/2}\textbf{S}^{n+1}
> $$
>
> and multiply $\textbf{{X}}^{n+1,\top}_{i+1/2}$ and $\textbf{{V}}^{n+1,\top}$ from the left and the right, respectively. If we define $\widetilde{\textbf{{g}}}^{n}_{i+1/2}=\textbf{{X}}^{n+1,\top}_{i+1/2}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}$ and $\textbf{{g}}^{n+1}_{i+1/2}=\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}$, we obtain
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\textbf{{g}}^{n+1}_{i+1/2} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{\textbf{{g}}}^{n}_{i+1/2}-\varepsilon\textbf{{X}}^{n+1,\top}_{i+1/2}\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top} \tag{4.9}
> $$
>
> $$
> \displaystyle-\sum_{j}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{{X}}^{n+1}_{j+1/2}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\textbf{{V}}^{n+1}\textbf{{V}}^{n+1,\top}
> $$
>
> $$
> \displaystyle-\sum_{j}\sigma^{a}_{j+1/2}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{{X}}^{n+1}_{j+1/2}\textbf{{g}}^{n+1}_{j+1/2}\textbf{{V}}^{n+1}\textbf{{V}}^{n+1,\top}.
> $$
>
> Defining the projection matrix onto the spatial basis as $\textbf{P}^{X}\in\mathbb{R}^{\\ Nx\times N_{x}}$ with entries
>
> $$
> P^{X}_{ij}=\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{{X}}^{n+1}_{j+1/2}=\sum_{q}X^{n+1}_{i+1/2,q}X^{n+1}_{j+1/2,q}
> $$
>
> and the projection matrix onto the angular basis as $\textbf{P}^{V}=\textbf{{V}}^{n+1}\textbf{{V}}^{n+1,\top}\in\mathbb{R}^{N\times N}$, (4.9) reads
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\textbf{{g}}^{n+1}_{i+1/2} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{\textbf{{g}}}^{n}_{i+1/2}-\varepsilon\textbf{{X}}^{n+1,\top}_{i+1/2}\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}
> $$
>
> $$
> \displaystyle-\sum_{j}P^{X}_{ij}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\textbf{P}^{V}-\sum_{j}\sigma^{a}_{j+1/2}P^{X}_{ij}\textbf{{g}}^{n+1}_{j+1/2}\textbf{P}^{V}.
> $$
>
> Thus, if $1\leq k\leq N$, the evolution equation for the $k^{\text{th}}$ moment, $g^{n+1}_{i+1/2,k}$, is given by
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}g^{n+1}_{i+1/2,k} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{g}^{n}_{i+1/2,k}-\varepsilon\textbf{{X}}^{n+1,\top}_{i+1/2}\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}\textbf{{e}}_{k} \tag{4.10}
> $$
>
> $$
> \displaystyle-\sum_{j}P^{X}_{ij}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\textbf{P}^{V}\textbf{{e}}_{k}-\sum_{j}\sigma^{a}_{j+1/2}P^{X}_{ij}\textbf{{g}}^{n+1}_{j+1/2}\textbf{P}^{V}\textbf{{e}}_{k},
> $$
>
> where $\textbf{{e}}_{k}=(\delta_{ik})_{i=1,\ldots,N}$. First, we consider the second term on the right-hand side of (4.10) and split it into two sub-equations
>
> $$
> \displaystyle\textbf{{X}}^{n+1,\top}_{i+1/2}\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}\textbf{{e}}_{k} \displaystyle=\textbf{{X}}^{n+1,\top}_{i+1/2}\left[\sum_{j}\textbf{{X}}^{n+1}_{j+1/2}\mathcal{D}^{-}\textbf{{X}}^{n+1,\top}_{j+1/2}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}\textbf{A}^{+}\textbf{{V}}^{n+1}\right.
> $$
>
> $$
> \displaystyle\hskip 18.49988pt\left.+\sum_{j}\textbf{{X}}^{n+1}_{j+1/2}\mathcal{D}^{+}\textbf{{X}}^{n+1,\top}_{j+1/2}\widetilde{\textbf{S}}^{n}\textbf{{V}}^{n+1,\top}\textbf{A}^{-}\textbf{{V}}^{n+1}\right]\textbf{{V}}^{n+1,\top}\textbf{{e}}_{k}
> $$
>
> $$
> \displaystyle=\sum_{j,\ell,q}P^{X}_{ij}\mathcal{D}^{-}\widetilde{g}^{n}_{j+1/2,\ell}A^{+}_{\ell q}P^{V}_{qk}+\sum_{j,\ell,q}P^{X}_{ij}\mathcal{D}^{+}\widetilde{g}^{n}_{j+1/2,\ell}A^{-}_{\ell q}P^{V}_{qk}.
> $$
>
> Similarly, expanding the third and the fourth term on the right-hand side of (4.10) we get
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}g^{n+1}_{i+1/2,k} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{g}^{n}_{i+1/2,k}-\varepsilon\sum_{j,\ell,q}P^{X}_{ij}\mathcal{D}^{-}\widetilde{g}^{n}_{j+1/2,\ell}A^{+}_{\ell q}P^{V}_{qk}-\varepsilon\sum_{j,\ell,q}P^{X}_{ij}\mathcal{D}^{+}\widetilde{g}^{n}_{j+1/2,\ell}A^{-}_{\ell q}P^{V}_{qk} \tag{4.11}
> $$
>
> $$
> \displaystyle-\sum_{j,q}P^{X}_{ij}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})b_{q}P^{V}_{qk}-\sum_{j,q}P^{X}_{ij}\sigma^{a}_{j+1/2}g^{n+1}_{j+1/2,q}P^{V}_{qk}.
> $$
>
> Multiplying (4.11) by $g^{n+1}_{i+1/2,k}\Delta x$ and summing over $i$, $k$ we get
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\sum_{i,k}(g^{n+1}_{i+1/2,k})^{2}\Delta x \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\sum_{i,k}\widetilde{g}^{n}_{i+1/2,k}g^{n+1}_{i+1/2,k}\Delta x-\varepsilon\sum_{j,\ell,q}\mathcal{D}^{-}\widetilde{g}^{n}_{j+1/2,\ell}A^{+}_{\ell q}\sum_{i,k}P^{V}_{qk}P^{X}_{ij}g^{n+1}_{i+1/2,k}\Delta x \tag{4.12}
> $$
>
> $$
> \displaystyle-\varepsilon\sum_{j,\ell,q}\mathcal{D}^{+}\widetilde{g}^{n}_{j+1/2,\ell}A^{-}_{\ell q}\sum_{i,k}P^{V}_{qk}P^{X}_{ij}g^{n+1}_{i+1/2,k}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j,q}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})b_{q}\sum_{i,k}P^{V}_{qk}P^{X}_{ij}g^{n+1}_{i+1/2,k}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j,q}\sigma^{a}_{j+1/2}g^{n+1}_{j+1/2,q}\sum_{i,k}P^{V}_{qk}P^{X}_{ij}g^{n+1}_{i+1/2,k}\Delta x.
> $$
>
> Using
>
> $$
> \sum_{i}P^{X}_{ij}g^{n+1}_{i+1/2,k}=g^{n+1}_{j+1/2,k},\hskip 18.49988pt\sum_{k}P^{V}_{qk}g^{n+1}_{j+1/2,k}=g^{n+1}_{j+1/2,q}. \tag{4.13}
> $$
>
> and Property 1, (4.12) reduces to
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{2c\Delta t}\left(\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\left\lVert\widetilde{\textbf{g}}^{n}\right\rVert^{2}+\left\lVert\textbf{g}^{n+1}-\widetilde{\textbf{g}}^{n}\right\rVert^{2}\right) \displaystyle=-\varepsilon\sum_{j,\ell,q}\mathcal{D}^{-}\widetilde{g}^{n}_{j+1/2,\ell}A^{+}_{\ell q}g^{n+1}_{j+1/2,q}\Delta x
> $$
>
> $$
> \displaystyle-\varepsilon\sum_{j,\ell,q}\mathcal{D}^{+}\widetilde{g}^{n}_{j+1/2,\ell}A^{-}_{\ell q}g^{n+1}_{j+1/2,q}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j,q}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})b_{q}g^{n+1}_{j+1/2,q}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j,q}\sigma^{a}_{j+1/2}\widetilde{g}^{n+1}_{j+1/2,q}g^{n+1}_{j+1/2,q}\Delta x.
> $$
>
> Collecting into a vector, we get
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{2c\Delta t}\left(\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\left\lVert\widetilde{\textbf{g}}^{n}\right\rVert^{2}+\left\lVert\textbf{g}^{n+1}-\widetilde{\textbf{g}}^{n}\right\rVert^{2}\right) \displaystyle=-\varepsilon\sum_{j}\left(\mathcal{L}^{\top}\widetilde{\textbf{{g}}}^{n}_{j+1/2}\right)\textbf{{g}}^{n+1,\top}_{j+1/2}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j}\textbf{{b}}^{\top}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{g}}^{n+1,\top}_{j+1/2}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{j}\sigma^{a}_{j+1/2}\textbf{{g}}^{n+1}_{j+1/2}\textbf{{g}}^{n+1,\top}_{j+1/2}\Delta x.
> $$
>
> The above equation is equivalent to (A.6). Similarly, substituting the temperature update (4.6) in (4.5) we get
>
> $$
> \left(\frac{aT^{n+1}_{i}+\frac{\varepsilon^{2}}{c}h^{n+1}_{i}-aT^{n}_{i}-\frac{\varepsilon^{2}}{c}h^{n+1}_{i}}{\Delta t}\right)+\frac{\gamma_{1}}{2}\mathcal{D}^{0}\textbf{{X}}^{n+1,\top}_{i}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}\textbf{{e}}_{1}=-\sigma^{a}_{i}h^{n+1}_{i}. \tag{4.14}
> $$
>
> Multiplying (4.14) by $aT^{n+1}_{i}+\frac{\varepsilon^{2}}{c}h^{n+1}_{i}$, summing over $i$ and using Property 1 yields
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert-\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert\right. \displaystyle\left.+\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}-aT^{n}-\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert\right) \tag{4.15}
> $$
>
> $$
> \displaystyle+\frac{\gamma_{1}}{2}\sum_{i}(aT^{n+1}_{i}+\frac{\varepsilon^{2}}{c}h^{n+1}_{i})\mathcal{D}^{0}g^{n+1}_{i,1} \displaystyle=-\sum_{i}\sigma^{a}_{i}(aT^{n+1}_{i}+\frac{\varepsilon^{2}}{c}h^{n+1}_{i})h^{n+1}_{i}
> $$
>
> which is the same as (A.5). The rest of the proof follows along the lines of Theorem 2 (see Appendix A).
>
> ∎

#### 4.1.3 Local mass conservation

> **Theorem 5**
>
> *The fixed-rank modal macro-micro BUG scheme is locally conservative. I.e., if the scalar flux at time $t_{n}$ is denoted by $\Phi_{i}^{n}=acT_{i}^{n}+\varepsilon^{2}h_{i}^{n}$, where $n\in\{0,1\}$ and $g_{i+1/2,k}^{n+1}=\sum_{\ell,m}X_{i+1/2,\ell}^{n+1}S_{\ell m}^{n+1}V_{km}^{n+1}$ the scheme fulfills the discrete conservation law*
>
> $$
> \frac{\Phi^{n+1}_{i}-\Phi^{n}_{i}}{\Delta t}+c\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}=-c\sigma^{a}_{i}h^{n+1}_{i}, \tag{4.16a}
> $$
>
> $$
> \frac{c_{\nu}}{2}\left(\frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}\right)=\sigma^{a}_{i}h^{n+1}_{i}\,. \tag{4.16b}
> $$

> **Proof**
>
> Since, for zero or periodic boundary conditions, $\sum_{i}c\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}=0$, this means that the total mass $\sum_{i}\left(\frac{1}{c}\Phi_{i}^{n}+\frac{c_{\nu}}{2}T^{n}_{i}\right)$ is conserved over all time steps $n$. This result is a direct consequence of the macro-micro strategy as shown in [23] and follows from multiplying (4.6) with $ac$ and adding (4.5) for the linearized problem. ∎

### 4.2 Asymptotic-preserving modification to augmented BUG integrator

We see from Theorem 3 that the updated spatial and angular basis span $\frac{\Psi^{n}_{i+1/2}}{\sigma^{a}_{i+1/2}}\delta^{0}(acT^{n}_{i+1/2})$ and **b**, respectively. Unlike the fixed-rank BUG integrator [9], naively using the augmented BUG integrator [10] does not guarantee that this property is fulfilled since the truncation step may prune away essential basis vectors. Thus, we propose the following modification to the augmented BUG integrator, based on its basis-augmentation step and conservative truncation [22], to obtain an asymptotic-preserving scheme. To ease the presentation of the integrator, we consider the spatially and angularly discretized problem from Section 4.1 so that $\textbf{g}\in\mathbb{R}^{N_{x}\times N}$. Thus, the low-rank ansatz takes the form

$$
\textbf{g}(t)=\textbf{X}(t)\textbf{S}(t)\textbf{{V}}(t)^{\top}.
$$

Then, one step of the modal macro-micro BUG scheme updates $\textbf{X}^{n},\textbf{{V}}^{n},\textbf{S}^{n},h^{n},T^{n}$ from time $t_{n}$ to $t_{n+1}$ by the following steps

1. Spatial and angular basis update

   **K****-step**: Update $\textbf{K}(t_{n+1})\in\mathbb{R}^{N_{x}\times r}$ according to the K-step (4.2) of the fixed-rank modal macro-micro BUG scheme. Then compute $\widehat{\textbf{X}}^{n+1}$ as an orthonormal basis of $\begin{bmatrix}(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})&\textbf{K}(t_{n+1})&\textbf{X}^{n}\end{bmatrix}$ and store $\widehat{\textbf{M}}=\widehat{\textbf{X}}^{n+1,\top}\textbf{X}^{n}\in\mathbb{R}^{(2r+1)\times r}$.

   **L****-step**: Update $\textbf{L}(t_{n+1})\in\mathbb{R}^{N\times r}$ according to the L-step (4.3) of the fixed-rank modal macro-micro BUG scheme. Then compute $\widehat{\textbf{{V}}}^{n+1}$ as an orthonormal basis of $\begin{bmatrix}\textbf{{b}}&\textbf{L}(t_{n+1})&\textbf{{V}}^{n}\end{bmatrix}$ and store $\widehat{\textbf{N}}=\widehat{\textbf{{V}}}^{n+1,\top}\textbf{{V}}^{n}\in\mathbb{R}^{(2r+1)\times r}$.
2. Perform a Galerkin update of the coefficient matrix $\widehat{\textbf{S}}^{n+1}$ similar to (2) with the initial condition $\widetilde{\textbf{S}}^{n}=\widehat{\textbf{M}}^{\top}\textbf{S}^{n}\widehat{\textbf{N}}^{\top}$ and the right-hand side as described in (4.4) of the fixed-rank modal macro-micro BUG scheme.
3. Asymptotic-preserving splitting of the basis matrices and truncation

   Set $\widehat{\textbf{K}}=\widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}$ and split $\widehat{\textbf{K}}=\begin{bmatrix}\widehat{\textbf{K}}^{\text{ap}}&\widehat{\textbf{K}}^{\text{rem}}\end{bmatrix}$ into basis vectors, where $\widehat{\textbf{K}}^{\text{ap}}=\begin{bmatrix}(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\end{bmatrix}\in\mathbb{R}^{N_{x}\times 1}$ and the remaining basis vectors into $\widehat{\textbf{K}}^{\text{rem}}\in\mathbb{R}^{N_{x}\times 2r}$. Similarly, split the angular basis $\widehat{\textbf{{V}}}=\begin{bmatrix}\widehat{\textbf{{V}}}^{\text{ap}}&\widehat{\textbf{{V}}}^{\text{rem}}\end{bmatrix}$, where $\widehat{\textbf{{V}}}^{\text{ap}}=\begin{bmatrix}\textbf{{b}}\end{bmatrix}\in\mathbb{R}^{N\times 1}$ and $\widehat{\textbf{{V}}}^{\text{rem}}\in\mathbb{R}^{N\times 2r}$.

   Next compute the QR decomposition of $\widehat{\textbf{K}}^{\text{rem}}$

   $$
   \widehat{\textbf{K}}^{\text{rem}}=\widehat{\textbf{X}}^{\text{rem}}\widehat{\textbf{S}}^{\text{rem}}.
   $$

   and for truncating the rank compute the SVD of $\widehat{\textbf{S}}^{\text{rem}}$ as

   $$
   \widehat{\textbf{S}}^{\text{rem}}=\textbf{U}\boldsymbol{\Sigma}\textbf{W}^{\top}. \tag{4.17}
   $$

   We truncate the remaining basis vectors to $1\leq r^{*}\leq 2r$ such that if $\hat{\sigma}_{i}$, $i=1,\ldots,2r$, are the singular values of $\widehat{\textbf{S}}^{\text{rem}}$ then for some user defined tolerance $\vartheta$ the following is satisfied:

   $$
   \left(\sum_{i=r^{*}+1}^{2r}\hat{\sigma}_{i}\right)^{1/2}\leq\vartheta.
   $$

   The new rank is set as $r_{1}=r^{*}+1$. Then let $\widehat{\textbf{U}}\in\mathbb{R}^{2r\times r^{*}}$ and $\widehat{\textbf{W}}\in\mathbb{R}^{2r\times r^{*}}$ be the matrices containing the first $r^{*}$ columns of **U** and **W**, respectively. Similarly, let $\widehat{\boldsymbol{\Sigma}}$ be the first $r^{*}\times r^{*}$ block of $\boldsymbol{\Sigma}$; then we set

   $$
   \textbf{X}^{\text{rem}}=\widehat{\textbf{X}}^{\text{rem}}\widehat{\textbf{U}},\hskip 18.49988pt\textbf{S}^{\text{rem}}=\widehat{\boldsymbol{\Sigma}},\hskip 18.49988pt\textbf{W}^{n+1}=\widehat{\textbf{{V}}}^{\text{rem}}\widehat{\textbf{W}}.
   $$

   Then we get the updated angular basis $\textbf{{V}}^{n+1}\in\mathbb{R}^{N\times r_{1}}$ by adding columns, i.e.

   $$
   \textbf{{V}}^{n+1}=\begin{bmatrix}\widehat{\textbf{{V}}}^{\text{ap}}&\textbf{W}^{n+1}\end{bmatrix}.
   $$

   For the updated spatial basis, we first compute the QR decomposition of $\widehat{\textbf{K}}^{\text{ap}}$ as

   $$
   \widehat{\textbf{K}}^{\text{ap}}=\textbf{X}^{\text{ap}}\textbf{S}^{\text{ap}}.
   $$

   Then set $\widehat{\textbf{X}}=\begin{bmatrix}\textbf{X}^{\text{ap}}&\textbf{X}^{\text{rem}}\end{bmatrix}$ and subsequently perform a QR decomposition to obtain the updated spatial basis matrix $\textbf{X}^{n+1}\in\mathbb{R}^{N_{x}\times r_{1}}$,

   $$
   \textbf{X}^{n+1}\textbf{R}_{2}=\widehat{\textbf{X}}. \tag{4.18}
   $$

   Finally we set the updated coefficient matrix $\textbf{S}^{n+1}\in\mathbb{R}^{r_{1}\times r_{1}}$ to be

   $$
   \textbf{S}^{n+1}=\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
   \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix} \tag{4.19}
   $$

   and the approximation at the next time step is set as $\textbf{g}^{n+1}=\textbf{X}^{n+1}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}$.
4. Update $T,h$:

   $$
   \frac{\varepsilon^{2}}{c}\left(\frac{h^{n+1}_{i}-h^{n}_{i}}{\Delta t}\right)+a\kappa\hskip 1.42262pt\sigma^{a}_{i}\Psi^{n}_{i}h^{n+1}_{i}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}\textbf{{X}}^{n+1,\top}_{i+1/2}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}\textbf{{e}}_{1}=-\sigma^{a}_{i}h^{n+1}_{i}, \tag{4.20}
   $$

   $$
   \frac{T^{n+1}_{i}-T^{n}_{i}}{\Delta t}=\kappa\hskip 1.42262pt\sigma^{a}_{i}h^{n+1}_{i}. \tag{4.21}
   $$

> **Lemma 1**
>
> *For the proposed modal macro-micro BUG scheme, we have*
>
> $$
> \textbf{R}_{2}^{-\top}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-\top}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{U}}^{\top}(\widehat{\textbf{S}}^{\text{rem}})^{-\top}\ \end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}=\textbf{S}^{n+1},
> $$
>
> *where the matrices are as defined above and $\textbf{I}_{m}$ is the $m\times m$ identity matrix.*

> **Proof**
>
> See Appendix B. ∎

> **Theorem 6**
>
> *The proposed modal macro-micro BUG scheme is asymptotic-preserving in the sense of Theorem 3.*

> **Proof**
>
> From the K- and L-step of the modal macro-micro BUG scheme we get $(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\in\text{Range }(\widehat{\textbf{X}}^{n+1})$ and $\textbf{{b}}\in\text{Range }(\widehat{\textbf{{V}}}^{n+1})$. Thus, along the lines of Theorem 3 for $\varepsilon\to 0$ we get from the $S$-step of the modal macro-micro BUG scheme
>
> $$
> -\left(\widehat{\textbf{X}}^{n+1,\top}(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\right)\left(\textbf{{b}}^{\top}\widehat{\textbf{{V}}}^{n+1}\right)=\widehat{\textbf{S}}^{n+1}. \tag{4.22}
> $$
>
> Now, to show that the proposed scheme is asymptotic-preserving, we need to show two things; first, that $(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\in\text{Range}(\textbf{X}^{n+1})$ and $\textbf{{b}}\in\text{Range}(\textbf{{V}}^{n+1})$. Second, we need to show that the above relation (4.22) also holds for the truncated factor matrices $\textbf{X}^{n+1},\textbf{{V}}^{n+1}$ and $\textbf{S}^{n+1}$. The first property follows directly from the construction of the scheme. For the latter, we can represent $\textbf{X}^{n+1}$ as
>
> $$
> \displaystyle\textbf{X}^{n+1} \displaystyle=\begin{bmatrix}\textbf{X}^{\text{ap}}&\textbf{X}^{\text{rem}}\end{bmatrix}\textbf{R}_{2}^{-1}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\widehat{\textbf{K}}^{\text{ap}}(\textbf{S}^{\text{ap}})^{-1}&\widehat{\textbf{X}}^{\text{rem}}\widehat{\textbf{U}}\end{bmatrix}\textbf{R}_{2}^{-1}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\widehat{\textbf{K}}^{\text{ap}}(\textbf{S}^{\text{ap}})^{-1}&\widehat{\textbf{K}}^{\text{rem}}(\widehat{\textbf{S}}^{\text{rem}})^{-1}\widehat{\textbf{U}}\end{bmatrix}\textbf{R}_{2}^{-1}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\widehat{\textbf{K}}^{\text{ap}}&\widehat{\textbf{K}}^{\text{rem}}\end{bmatrix}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-1}&\textbf{0}\\
> \textbf{0}&(\widehat{\textbf{S}}^{\text{rem}})^{-1}\widehat{\textbf{U}}\end{bmatrix}\textbf{R}_{2}^{-1}
> $$
>
> $$
> \displaystyle=\widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-1}&\textbf{0}\\
> \textbf{0}&(\widehat{\textbf{S}}^{\text{rem}})^{-1}\widehat{\textbf{U}}\end{bmatrix}\textbf{R}_{2}^{-1}.
> $$
>
> Thus we get
>
> $$
> \textbf{X}^{n+1,\top}=\textbf{R}_{2}^{-\top}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-\top}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{U}}^{\top}(\widehat{\textbf{S}}^{\text{rem}})^{-\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{X}}^{n+1,\top}
> $$
>
> and similarly, we get the following relation for the updated angular basis
>
> $$
> \displaystyle\textbf{{V}}^{n+1} \displaystyle=\begin{bmatrix}\widehat{\textbf{{V}}}^{\text{ap}}&\textbf{W}^{n+1}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\widehat{\textbf{{V}}}^{\text{ap}}&\widehat{\textbf{{V}}}^{\text{rem}}\end{bmatrix}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}.
> $$
>
> This yields the relation
>
> $$
> \textbf{{V}}^{n+1}=\widehat{\textbf{{V}}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix},
> $$
>
> where $\textbf{I}_{m}$ is the $m\times m$ identity matrix. Now we multiply (4.22) by $\textbf{R}_{2}^{-\top}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-\top}&\textbf{0}\\ \textbf{0}&\widehat{\textbf{U}}^{\top}(\widehat{\textbf{S}}^{\text{rem}})^{-\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}$ from the left and by $\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\ \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}$ from the right and using Lemma 1 for the right-hand side gives
>
> $$
> -\left(\textbf{X}^{n+1,\top}(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\right)\left(\textbf{{b}}^{\top}\textbf{{V}}^{n+1}\right)=\textbf{S}^{n+1}.
> $$
>
> Thus by multiplying by $\textbf{X}^{n+1}$ and $\textbf{{V}}^{n+1}$ from the left and the right and using the fact that $(\boldsymbol{\sigma^{a}})^{-1}\Psi^{n}\boldsymbol{\delta^{0}}(ac\textbf{T}^{n})\in\text{Range}(\textbf{X}^{n+1})$ and $\textbf{{b}}\in\text{Range}(\textbf{{V}}^{n+1})$ we can show that the proposed scheme is asymptotic-preserving by following the steps from Theorem 3. ∎

#### 4.2.1 Energy stability

> **Theorem 7**
>
> *Assume that the CFL condition (3.4) from Theorem 2 holds. Then the modal macro-micro BUG scheme is energy stable for the linearized problem (3.3), where the energy is the same as defined in Theorem 4.*

> **Proof**
>
> Similar to Theorem 4 we start by considering the $S$-step of the modal macro-micro BUG scheme where,
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\widehat{\textbf{S}}^{n+1} \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\widetilde{\textbf{S}}^{n}-\varepsilon\mathcal{L}_{S}\widetilde{\textbf{S}}^{n}-\sum_{j}\widehat{\textbf{{X}}}^{n+1}_{j+1/2}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\widehat{\textbf{{V}}}^{n+1} \tag{4.23}
> $$
>
> $$
> \displaystyle-\sum_{j}\sigma^{a}_{j+1/2}\widehat{\textbf{{X}}}^{n+1}_{j+1/2}\widehat{\textbf{{X}}}^{n+1,\top}_{j+1/2}\widehat{\textbf{S}}^{n+1}.
> $$
>
> We note that $\sum_{i}\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}\widetilde{\textbf{S}}^{n}\widehat{\textbf{{V}}}^{n+1,\top}=\sum_{i}\textbf{{X}}^{n,\top}_{i+1/2}\textbf{S}^{n}\textbf{{V}}^{n,\top}$. Multiplying (4.23) by $\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}$ from the left and $\widehat{\textbf{{V}}}^{n+1,\top}$ from the right, then summing over $i$ we get
>
> $$
> \displaystyle\frac{\varepsilon^{2}}{c\Delta t}\sum_{i}\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}\widehat{\textbf{S}}^{n+1}\widehat{\textbf{{V}}}^{n+1,\top}\Delta x \displaystyle=\frac{\varepsilon^{2}}{c\Delta t}\sum_{i}\textbf{{X}}^{n,\top}_{i+1/2}\textbf{S}^{n}\textbf{{V}}^{n,\top}\Delta x-\varepsilon\sum_{i}\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}\mathcal{L}_{S}\widetilde{\textbf{S}}\widehat{\textbf{{V}}}^{n+1,\top}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{i,j}\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}\widehat{\textbf{{X}}}^{n+1}_{j+1/2}\delta^{0}(acT^{n}_{j+1/2}+\varepsilon^{2}h^{n}_{j+1/2})\textbf{{b}}^{\top}\widehat{\textbf{{V}}}^{n+1}\widehat{\textbf{{V}}}^{n+1}\Delta x
> $$
>
> $$
> \displaystyle-\sum_{i,j}\sigma^{a}_{j+1/2}\widehat{\textbf{{X}}}^{n+1,\top}_{i+1/2}\widehat{\textbf{{X}}}^{n+1}_{j+1/2}\widehat{\textbf{{X}}}^{n+1,\top}_{j+1/2}\widehat{\textbf{S}}^{n+1}\widehat{\textbf{{V}}}^{n+1}\Delta x.
> $$
>
> Since the truncation step of the integrator does not increase the norm of the solution
>
> $$
> \left\lVert\textbf{X}^{n+1}\textbf{S}^{n+1}\textbf{{V}}^{n+1,\top}\right\rVert=\left\lVert\textbf{S}^{n+1}\right\rVert\leq\left\lVert\widehat{\textbf{S}}^{n+1}\right\rVert=\left\lVert\widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}\widehat{\textbf{{V}}}^{n+1,\top}\right\rVert.
> $$
>
> The rest of the proof follows along the lines of Theorem 4. ∎

## 5 Numerical results

The following numerical results can be reproduced with the openly available source code [27].

### 5.1 Rectangular pulse test case

We consider gray thermal radiative transfer equations in slab geometry (2.1) on the spatial domain $D=[-10,10]$. The initial distribution of the temperature is given by the rectangular pulse

$$
T(t=0,x)=\frac{100}{\sigma^{a}(x)}\cdot\chi_{[-0.5,0.5]}(x).
$$

The particle density is initially at an equilibrium with the temperature and is given by

$$
f(t=0,x,\mu)=acT(t=0,x).
$$

Subsequently, as time progresses, the particles move into all directions $\mu\in[-1,1]$ while undergoing isotropic absorption at the rate $\sigma^{a}(x)=0.5$. In this test case, we assume that no particles are present at the boundary during the entire simulation, and the temperature remains zero at the boundary as well. The initial and boundary conditions for $g$ and $h$ can be derived from those for temperature and particle density by using the relations (2.5). We assume that constants are scaled to $1$, i.e., we set the radiation constant $a=1$, speed of light $c=1$, and the specific heat is $c_{\nu}=1$. The mass at time $t_{n}$ is defined as

$$
m^{n}=\sum_{i}\left(aT^{n}_{i}+\frac{\varepsilon^{2}}{c}h^{n}_{i}+\frac{c_{\nu}}{2}T^{n}_{i}\right)\Delta x. \tag{5.1}
$$

The spatial domain is divided into $N_{x}=501$ spatial cells, and we use $N=100$ Legendre polynomials to represent the angular variable. The moment solutions (P_N) are computed using the modal macro-micro scheme (3.3). For $\varepsilon=1$, we choose a rank of $r=5,15$ for the fixed-rank modal macro-micro BUG integrator (frBUG) and an initial rank of $r=1$ for the modal macro-micro BUG integrator (BUG). For rank truncation we set the tolerance parameter to $\vartheta=5\cdot 10^{-2}\left\lVert\boldsymbol{\Sigma}\right\rVert_{2}$ and the end time is set to $t_{\text{end}}=1.5$. The step size is chosen according to (3.4)

$$
\Delta t=\underset{k}{\text{min}}\left\{\frac{1}{5c\beta_{N}}\left(\frac{2\varepsilon\Delta x}{\left\lvert\mu_{k}\right\rvert}+\frac{\sigma_{0}\Delta x^{2}}{\mu_{k}^{2}}\right)\right\}
$$

where, for $N=100$ the step size is minimal for $\mu_{k}=-0.999719$ which gives the step size $\Delta t\approx 0.005$. We compare the low-rank approximations with the moment solutions P_5, P_{15} and P_{100}, and the results are given in Figure 2. The relative mass error of all the low-rank solutions as well as the P_{100} solution is given in Figure 1(a). Note that the chosen step size for the P_5 and P_{15} solutions differs from that of the rest of the solutions and is minimal for a different quadrature point, which we do not specify here. From the plots of temperature and scalar flux, we see that the solution of the fixed-rank modal macro-micro BUG integrator with $r=15$ (BUG_{15}) and the modal macro-micro BUG integrator agree well with the full moment solution P_{100} and are different from the Rosseland diffusion limit. Additionally, the BUG_5 approximation performs much better than the P_5 solution. All the integrators dissipate energy over time, as we see from Figure 3.

**Figure 1.** Relative mass error for the rectangular pulse test case in the kinetic and diffusive regime.

**(a).** $\varepsilon=1.0$

**(b).** $\varepsilon=10^{-5}$

**Figure 2.** Numerical results of the rectangular pulse test case in the kinetic regime, i.e., $\varepsilon=1$ at $t=1.5$. In the first row, we present the temperature profile at end-time for the moment and low-rank methods; in the second row, we have the corresponding scalar flux. In the last row, we have the energy of the system over time for all the methods and the rank evolution of the BUG integrator.

**(a).** moment methods

**(b).** low-rank methods

**(c).** energy over time

**(d).** rank over time BUG

For $\varepsilon=10^{-5}$, we use a coarser spatial grid with $N_{x}=201$ cells. The rank used for the fixed-rank modal macro-micro BUG integrator is $r=1$, and the modal macro-micro BUG integrator starts with the same initial rank $r=1$. The tolerance parameter and end time are the same as in the kinetic regime. We see from Figures 3 and 1 that the solutions from the full modal macro-micro integrator, fixed-rank modal macro-micro BUG integrator, and modal macro-micro BUG integrator agree well with the limiting Rosseland approximation. Additionally, all the methods dissipate energy over time.

**Figure 3.** Numerical results of the rectangular pulse test case in the diffusive regime, i.e. $\varepsilon=10^{-5}$ at $t=1.5$. Top left: Temperature profile, Top right: Scalar flux, Bottom left: Energy of the system over time for all the methods, Bottom right: Rank evolution of rank-adaptive integrator over time.

### 5.2 Absorber test case

To study the behavior of the methods in an inhomogeneous medium, we place an absorber in the middle of the domain. That is, we set the absorption coefficient to

$$
\sigma^{a}(x)=\begin{cases}5,&\mathrm{if}-0.25\leq x\leq 0.25,\\
0.5&\mathrm{else}\end{cases}.
$$

The remaining parameters, along with the end time, are the same as in the rectangular pulse test case. The temperature and scalar flux, along with other parameters, are depicted in Figure 4 for $\varepsilon=1$ and in Figure 5 for $\varepsilon=10^{-5}$.

**Figure 4.** Numerical results of the absorber test case in the kinetic regime, i.e., $\varepsilon=1$ at $t=1.5$. In the first row, we present the temperature profile at end-time for the moment and low-rank methods; in the second row, we have the corresponding scalar flux. In the last row, we have the energy of the system over time for all the methods and the rank evolution of the BUG integrator.

**(a).** moment methods

**(b).** low-rank methods

**(c).** energy over time

**(d).** rank over time BUG

**Figure 5.** Numerical results of the absorber test case in the diffusive regime, i.e., $\varepsilon=10^{-5}$ at $t=1.5$. Top left: Temperature profile, Top right: Scalar flux, Bottom left: Energy of the system over time for all the methods, Bottom right: Rank evolution of rank-adaptive integrator over time.

## 6 Conclusion

In this work, we propose a modal macro-micro BUG integrator for the radiative heat transfer equations. We show that this integrator is energy stable for the linearized problem under a CFL condition that captures the kinetic regime and diffusive regime of the thermal radiative transfer equations. Additionally, the full modal macro-micro scheme’s stability and the fixed-rank macro-micro BUG scheme have been investigated.

## Declaration of competing interests

The authors declare that they have no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

## Acknowledgment

The work of Chinmay Patwardhan and Martin Frank was funded by the Deutsche Forschungsgemeinschaft (DFG, German Research Foundation) – Project-ID 258734477 – SFB 1173.

## Appendix A Proof of Theorem 2

We start by stating some lemmas and properties used to prove stability in energy norm (Theorem 2) for the linearized modal macro-micro scheme (3.3).

> **Lemma 2 (Lemma 3.3 [19](Summation by parts))**
>
> *For vectors $\boldsymbol{\phi}_{i+1/2},\boldsymbol{\zeta}_{i+1/2}\in\mathbb{R}^{N}$ where $i=0,\ldots,N_{x}$, the equality*
>
> $$
> \sum_{i}\boldsymbol{\zeta}^{\top}_{i+1/2}\mathcal{D}^{\pm}\boldsymbol{\phi}_{i+1/2}=-\sum_{i}(\mathcal{D}^{\mp}\boldsymbol{\zeta}_{i+1/2})^{\top}\boldsymbol{\phi}_{i+1/2} \tag{A.1}
> $$
>
> *holds for periodic or zero values at the boundary.*

> **Lemma 3**
>
> *Let $\boldsymbol{\phi}_{i+1/2}\in\mathbb{R}^{N+1}$, for $i=0,\ldots,Nx$, then the following inequality holds*
>
> $$
> \sum_{i}\left(\mathcal{D}^{+}\boldsymbol{\phi}_{i+1/2}\right)^{2}\leq\frac{4}{\Delta x^{2}}\sum_{i}(\boldsymbol{\phi}_{i+1/2})^{2}. \tag{A.2}
> $$

> **Proof**
>
> Expanding the left-hand side using the definition of $\mathcal{D}^{+}$
>
> $$
> \displaystyle\sum_{i}\left(\mathcal{D}^{+}\boldsymbol{\phi}_{i+1/2}\right)^{2} \displaystyle=\frac{1}{\Delta x^{2}}\sum_{i}(\boldsymbol{\phi}_{i+3/2}-\boldsymbol{\phi}_{i+1/2})^{2}
> $$
>
> $$
> \displaystyle=\frac{2}{\Delta x^{2}}\sum_{i}(\boldsymbol{\phi}_{i+1/2})^{2}-\frac{2}{\Delta x^{2}}\sum_{i}\boldsymbol{\phi}_{i+3/2}^{\top}\boldsymbol{\phi}_{i+1/2}.
> $$
>
> Using Young’s inequality for the last term on the right-hand side in the above equation we get
>
> $$
> \left\lvert\frac{2}{\Delta x^{2}}\sum_{i}\boldsymbol{\phi}_{i+3/2}^{\top}\boldsymbol{\phi}_{i+1/2}\right\rvert\leq\frac{1}{\Delta x^{2}}\sum_{i}(\boldsymbol{\phi}_{i+1/2})^{2}+\frac{1}{\Delta x^{2}}\sum_{i}(\boldsymbol{\phi}_{i+3/2})^{2}. \tag{A.3}
> $$
>
> A change in the index in the last term gives the desired result. ∎

The constructed macro-micro system (3.3) with the stabilization matrix $\left\lvert\textbf{A}\right\rvert$ is related to the full $\mathrm{P}_{N}$ system through the flux matrix $\textbf{A}_{f}=\left(\left[P_{i-1}P_{j-1}\mu\right]_{\mu}\right)_{i,j=1}^{N+1}$ and Roe matrix $\left\lvert\textbf{A}_{f}\right\rvert=\textbf{T}_{f}\left\lvert\textbf{M}\right\rvert\textbf{T}_{f}^{\top}$, where $\textbf{T}_{f}=\left(\sqrt{w_{k}}P_{i-1}(\mu_{k})\right)_{i,j=1}^{N+1}$ such that $\textbf{A}_{f}=\textbf{T}_{f}\textbf{M}\textbf{T}_{f}^{\top}$. We additionally define

$$
\frac{1}{\gamma_{0}}\textbf{{b}}=\textbf{a}=(a_{0},0,\ldots,0)^{\top}\in\mathbb{R}^{N},\hskip 18.49988pt\textbf{a}_{f}=(0,a_{0},0,\ldots,0)^{\top}\in\mathbb{R}^{N+1}.
$$

> **Lemma 4 (Lemma 3.4 [19] ($\mathrm{P}_{N}$ preservation))**
>
> *For a given vector $\textbf{{g}}\in\mathbb{R}^{N}$ define its extension $\textbf{v}\coloneqq(0,g_{1},\ldots,g_{N})^{\top}\in\mathbb{R}^{N+1}$ as well as $\hat{\textbf{v}}_{i+1/2}\coloneqq\textbf{T}_{f}^{\top}\textbf{v}_{i+1/2}\in\mathbb{R}^{N+1}$. Then,*
>
> $$
> \textbf{{g}}^{\top}\textbf{A}^{2}\textbf{{g}}=\hat{\textbf{v}}^{\top}\textbf{M}^{2}\hat{\textbf{v}},\hskip 9.24994pt\textbf{{g}}^{\top}\left\lvert\textbf{A}\right\rvert\textbf{{g}}=\hat{\textbf{v}}^{\top}\left\lvert\textbf{M}\right\rvert\hat{\textbf{v}},\hskip 9.24994pt\textbf{{g}}^{\top}\textbf{a}\textbf{a}^{\top}\textbf{{g}}=\hat{\textbf{v}}^{\top}\textbf{T}_{f}^{\top}\textbf{a}_{f}\textbf{a}_{f}^{\top}\textbf{T}_{f}\hat{\textbf{v}}.
> $$

Two main properties of the advection operator, $\mathcal{L}$, that are used in proving energy stability are

> **Lemma 5 (Lemma 3.5 [19] (Positivity))**
>
> *For a given discrete function $\textbf{{g}}^{n}_{i+1/2}$, the advection operator fulfills the properties*
>
> $$
> \sum_{j}\textbf{{g}}_{i+1/2}^{n+1,\top}\mathcal{L}\textbf{{g}}_{i+1/2}^{n+1}=\sum_{i}\frac{\Delta x}{2}\mathcal{D}^{+}\textbf{{g}}_{i+1/2}^{n+1,\top}\left\lvert\textbf{A}\right\rvert\mathcal{D}^{+}\textbf{{g}}_{i+1/2}^{n+1}\geq 0
> $$
>
> *and*
>
> $$
> \displaystyle\sum_{j}\textbf{{g}}_{i+1/2}^{n+1,\top}\mathcal{L}\textbf{{g}}_{i+1/2}^{n} \displaystyle=\sum_{i}\frac{\Delta x}{2}\mathcal{D}^{+}\textbf{{g}}_{i+1/2}^{n+1,\top}\left\lvert\textbf{A}\right\rvert\mathcal{D}^{+}\textbf{{g}}_{i+1/2}^{n+1}
> $$
>
> $$
> \displaystyle+\sum_{i}(\textbf{{g}}_{i+1/2}^{n}-\textbf{{g}}_{i+1/2}^{n+1})^{\top}(\textbf{A}^{+}\mathcal{D}^{+}+\textbf{A}^{-}\mathcal{D}^{-})\textbf{{g}}_{i+1/2}^{n+1}.
> $$

> **Lemma 6 (Lemma 3.6 [19] (Boundedness))**
>
> *For a given discrete function $\textbf{{g}}^{n}_{i+1/2}$, the advection operator fulfills the property*
>
> $$
> \sum_{i}\left[(\textbf{A}^{+}\mathcal{D}^{+}+\textbf{A}^{-}\mathcal{D}^{-})\textbf{{g}}^{n+1}_{i+1/2}\right]^{2}\leq 2\beta_{N}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{A}^{2}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2},
> $$
>
> *where $\beta_{N}=\underset{k}{\mathrm{max}}\hskip 5.69054ptw_{k}(N+1)$ is bounded for all $N$.*

With these lemma we now present the proof of theorem 2:

> **Proof**
>
> We start by plugging in the update equation of the macro variable, $T$, (3.3c) into the update equation of the mesoscopic variable, $h$, (3.3a). This gives
>
> $$
> \frac{(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})-(aT_{i}^{n}+\frac{\varepsilon^{2}}{c}h_{i}^{n})}{\Delta t}+\frac{\gamma_{1}}{2}\mathcal{D}^{0}g_{1,i}^{n+1}=-\sigma^{a}_{i}h_{i}^{n+1}, \tag{A.4a}
> $$
>
> $$
> \frac{1}{c}\left(\frac{\textbf{{g}}_{i+1/2}^{n+1}-\textbf{{g}}_{i+1/2}^{n}}{\Delta t}\right)+\frac{1}{\varepsilon}\mathcal{L}\textbf{{g}}_{i+1/2}^{n}=-\frac{\sigma^{a}_{i+1/2}}{\varepsilon^{2}}\textbf{{g}}_{i+1/2}^{n+1}-\frac{1}{\varepsilon^{2}}\textbf{{b}}\hskip 1.42262pt\delta^{0}(acT^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2}). \tag{A.4b}
> $$
>
> Next we multiply the update equation for the micro equation (A.4a) by $(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\Delta x$, and sum over $i$,
>
> $$
> \displaystyle\frac{1}{\Delta t}\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})^{2}\Delta x-\frac{1}{\Delta t}\sum_{i}(aT_{i}^{n+1} \displaystyle+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})(aT_{i}^{n}+\frac{\varepsilon^{2}}{c}h_{i}^{n})\Delta x
> $$
>
> $$
> \displaystyle\hskip 18.49988pt+\frac{\gamma_{1}}{2}\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\mathcal{D}^{0}g_{1,i}^{n+1}\Delta x \displaystyle=-\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\sigma^{a}_{i}h_{i}^{n+1}\Delta x.
> $$
>
> Using the summation of products Property 1 we get
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}-\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}+\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}-aT^{n}-\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}\right)+ \tag{A.5}
> $$
>
> $$
> \displaystyle\frac{\gamma_{1}}{2}\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\mathcal{D}^{0}g_{1,i}^{n+1}\Delta x=-\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\sigma^{a}_{i}h_{i}^{n+1}\Delta x
> $$
>
> Multiply (A.4b) by $\textbf{{g}}^{n+1,\top}_{i+1/2}\Delta x$, and sum over $i$, and using the summation Property 1
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(\frac{1}{c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\frac{1}{c}\left\lVert\textbf{g}^{n}\right\rVert^{2}+\frac{1}{c}\left\lVert\textbf{g}^{n+1}-\textbf{g}^{n}\right\rVert^{2}\right)+\frac{1}{\varepsilon}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x \tag{A.6}
> $$
>
> $$
> \displaystyle\hskip 56.9055pt\leq-\frac{\sigma_{0}}{\varepsilon^{2}}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\frac{\gamma_{1}}{\varepsilon^{2}}\sum_{i}g^{n+1}_{1,i+1/2}\hskip 1.42262pt\delta^{0}(acT^{n}_{i+1/2}+\varepsilon^{2}h^{n}_{i+1/2})\Delta x,
> $$
>
> where we use $\sigma_{0}\leq\sigma^{a}_{i+1/2},\forall i$, and $\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{{b}}=\gamma_{1}g^{n+1}_{1,i+1/2}$. Then (A.5) $+\frac{\varepsilon^{2}}{\gamma_{0}^{2}c}\times$ (A.6), where $\gamma_{0}^{2}=2$ is the normalization factor of the zeroth order Legendre polynomial, gives
>
> $$
> \displaystyle\frac{1}{2\Delta t} \displaystyle\left(\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}\right\rVert^{2}-\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}-\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right. \tag{A.7}
> $$
>
> $$
> \displaystyle\left.+\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}-aT^{n}-\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right)
> $$
>
> $$
> \displaystyle+\frac{\gamma_{1}}{2}\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\mathcal{D}^{0}g_{1,i}^{n+1}\Delta x+\frac{\varepsilon}{2c}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x
> $$
>
> $$
> \displaystyle\leq-\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\sigma^{a}_{i}h_{i}^{n+1}\Delta x-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\frac{\gamma_{1}}{\gamma_{0}^{2}}\sum_{i}g^{n+1}_{1,i+1/2}\hskip 1.42262pt\delta^{0}(aT^{n}_{i+1/2}+\frac{\varepsilon^{2}}{c}h^{n}_{i+1/2})\Delta x\,.
> $$
>
> Using discrete integration by parts from Lemma 2 we get
>
> $$
> \sum_{i}g^{n+1}_{1,i+1/2}\hskip 1.42262pt\delta^{0}(aT^{n}_{i+1/2}+\frac{\varepsilon^{2}}{c}h^{n}_{i+1/2})\Delta x=-\sum_{i}\mathcal{D}^{0}g^{n+1}_{1,i}(aT_{i}^{n}+\frac{\varepsilon^{2}}{c}h^{n}_{i})\Delta x. \tag{A.8}
> $$
>
> With the use of (A.8) we rewrite (A.7) as
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}\right\rVert^{2}-\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}-\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right.
> $$
>
> $$
> \displaystyle\left.+\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}-aT^{n}-\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right)
> $$
>
> $$
> \displaystyle+\frac{\varepsilon}{2c}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1}) \displaystyle\sigma^{a}_{i}h_{i}^{n+1}\Delta x
> $$
>
> $$
> \displaystyle+\frac{\gamma_{1}}{2}\sum_{i}\mathcal{D}^{0}g^{n+1}_{1,i}(-aT^{n+1}_{i}-\frac{\varepsilon^{2}}{c}h^{n+1}_{i}+ \displaystyle aT^{n}_{i}+\frac{\varepsilon^{2}}{c}h^{n}_{i})\Delta x.
> $$
>
> Using Young’s inequality,
>
> $$
> \displaystyle\frac{\gamma_{1}}{2}\sum_{i}\mathcal{D}^{0}g^{n+1}_{1,i}(-aT^{n+1}_{i}-\frac{\varepsilon^{2}}{c}h^{n+1}_{i}+aT^{n}_{i}+\frac{\varepsilon^{2}}{c}h^{n}_{i})\Delta x \displaystyle\leq\alpha\left\lVert-aT^{n+1}-\frac{\varepsilon^{2}}{c}h^{n+1}+aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert
> $$
>
> $$
> \displaystyle+\frac{1}{4\alpha}\sum_{i}\frac{\gamma_{1}^{2}}{4}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x.
> $$
>
> Thus, setting $\alpha=\frac{1}{2\Delta t}$ we have
>
> $$
> \displaystyle\frac{1}{2\Delta t} \displaystyle\left(\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}\right\rVert^{2}-\left\lVert aT^{n}+\frac{\varepsilon^{2}}{c}h^{n}\right\rVert^{2}-\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right. \tag{A.9}
> $$
>
> $$
> \displaystyle\left.+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right)+\frac{\varepsilon}{2c}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x
> $$
>
> $$
> \displaystyle\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\sum_{i}(aT_{i}^{n+1}+\frac{\varepsilon^{2}}{c}h_{i}^{n+1})\sigma^{a}_{i}h_{i}^{n+1}\Delta x+\frac{\Delta t}{2}\frac{\gamma_{1}^{2}}{4}\sum_{i}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x.\hskip 18.49988pt\hskip 18.49988pt
> $$
>
> This gives an upper bound for the term $\left\lVert aT^{n+1}+\frac{\varepsilon^{2}}{c}h^{n+1}\right\rVert^{2}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}\right\rVert$. Next, we derive an upper bound for $\left\lVert\sqrt{\frac{a}{\kappa}}T^{n+1}\right\rVert^{2}$. For that we multiply the temperature update (3.3c) by $aT^{n+1}_{i}\Delta x$ and sum over $i$
>
> $$
> \frac{1}{\Delta t}\sum_{i}aT^{n+1}_{i}(T^{n+1}_{i}-T^{n}_{i})\Delta x=\kappa\sum_{i}aT^{n+1}_{i}\sigma^{a}_{i}h^{n+1}_{i}\Delta x.
> $$
>
> Thus, we get using the summation of products Property 1
>
> $$
> \frac{1}{2\Delta t}\left(\left\lVert\sqrt{\frac{a}{\kappa}}T^{n+1}\right\rVert^{2}-\left\lVert\sqrt{\frac{a}{\kappa}}T^{n}\right\rVert^{2}+\left\lVert\sqrt{\frac{a}{\kappa}}T^{n+1}-\sqrt{\frac{a}{\kappa}}T^{n}\right\rVert^{2}\right)=\sum_{i}aT^{n+1}_{i}\sigma^{a}_{i}h^{n+1}_{i}\Delta x. \tag{A.10}
> $$
>
> Adding (A.9) and (A.10) gives
>
> $$
> \displaystyle\frac{1}{2\Delta t} \displaystyle\left(e^{n+1}-e^{n}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right)+\frac{\varepsilon}{2c}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x \tag{A.11}
> $$
>
> $$
> \displaystyle\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}-\frac{\sigma_{0}}{c}\left\lVert\varepsilon h^{n+1}\right\rVert^{2}+\frac{\Delta t}{2}\frac{\gamma_{1}^{2}}{4}\sum_{i}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x-\left\lVert\sqrt{\frac{a}{\kappa}}T^{n+1}-\sqrt{\frac{a}{\kappa}}T^{n}\right\rVert^{2}.
> $$
>
> Since $-\frac{\sigma_{0}}{c}\left\lVert\varepsilon h^{n+1}\right\rVert^{2}\leq 0$ and $-\left\lVert\sqrt{\frac{a}{\kappa}}T^{n+1}-\sqrt{\frac{a}{\kappa}}T^{n}\right\rVert^{2}\leq 0$ we bound them from above by $0$.
>
> Then (A.11) becomes
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(e^{n+1}-e^{n}+\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert^{2}\right)+\frac{\varepsilon}{2c}\sum_{i}\textbf{{g}}^{n+1,\top}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x \tag{A.12}
> $$
>
> $$
> \displaystyle\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}+\frac{\Delta t}{2}\frac{\gamma_{1}^{2}}{4} \displaystyle\sum_{i}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x.\hskip 56.9055pt
> $$
>
> Next, we split the last term on the left-hand side of (A.12) as
>
> $$
> \sum_{i}\textbf{{g}}^{n+1}_{i+1/2}\mathcal{L}\textbf{{g}}^{n}_{i+1/2}\Delta x=P+Q
> $$
>
> where
>
> $$
> P=\sum_{i}\textbf{{g}}^{n+1}_{i+1/2}\mathcal{L}\textbf{{g}}^{n+1}_{i+1/2}\Delta x,\hskip 9.24994ptQ=\sum_{i}\textbf{{g}}^{n+1}_{i+1/2}\mathcal{L}(\textbf{{g}}^{n}_{i+1/2}-\textbf{{g}}^{n+1}_{i+1/2})\Delta x.
> $$
>
> Then, using Lemma 5 we have,
>
> $$
> \displaystyle P \displaystyle=\frac{\Delta x}{2}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\left\lvert\textbf{A}\right\rvert\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x, \tag{A.13}
> $$
>
> $$
> \displaystyle Q \displaystyle=-\sum_{i}(\textbf{A}^{+}\mathcal{D}^{+}+\textbf{A}^{-}\mathcal{D}^{-})\textbf{{g}}^{n+1,\top}_{i+1/2}(\textbf{{g}}^{n}_{i+1/2}-\textbf{{g}}^{n+1}_{i+1/2}).
> $$
>
> Thus, using Young’s inequality
>
> $$
> \left\lvert Q\right\rvert\leq\alpha\left\lVert\textbf{g}^{n+1}-\textbf{g}^{n}\right\rVert+\frac{1}{4\alpha}\sum_{i}\left[(\textbf{A}^{+}\mathcal{D}^{+}+\textbf{A}^{-}\mathcal{D}^{-})\textbf{{g}}^{n+1}_{i+1/2}\right]^{2}\Delta x
> $$
>
> and Lemma 5 we get
>
> $$
> \left\lvert Q\right\rvert\leq\alpha\left\lVert\textbf{g}^{n+1}-\textbf{g}^{n}\right\rVert+\frac{2\beta_{N}}{4\alpha}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{A}^{2}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x. \tag{A.14}
> $$
>
> We set $\alpha=\frac{\varepsilon}{2c\Delta t}$, then $\left\lVert\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n+1}-\frac{\varepsilon}{\gamma_{0}c}\textbf{g}^{n}\right\rVert$ gets canceled out and we get
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(e^{n+1}-e^{n}\right)+\frac{\varepsilon\Delta x}{4c}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\left\lvert\textbf{A}\right\rvert\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x-\beta_{N}\frac{\Delta t}{2}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{A}^{2}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x \tag{A.15}
> $$
>
> $$
> \displaystyle\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2}+\frac{\Delta t}{2}\frac{\gamma_{1}^{2}}{4}\sum_{i}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x
> $$
>
> We rewrite the last term on the right-hand side of (A.15) as
>
> $$
> \frac{\gamma_{1}^{2}}{4}\sum_{i}(\mathcal{D}^{0}g^{n+1}_{1,i})^{2}\Delta x=\frac{\gamma_{1}^{2}}{4}\sum_{i}(\mathcal{D}^{+}g^{n+1}_{1,i})^{2}\Delta x=\frac{1}{2}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{a}\textbf{a}^{\top}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x
> $$
>
> and we get
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(e^{n+1}-e^{n}\right) \displaystyle\leq-\frac{\sigma_{0}}{2c}\left\lVert\textbf{g}^{n+1}\right\rVert^{2} \tag{A.16}
> $$
>
> $$
> \displaystyle+\frac{1}{2}\sum_{i}\mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\left[\Delta t\left(\beta_{N}\textbf{A}^{2}+\frac{1}{2}\textbf{a}\textbf{a}^{\top}\right)-\frac{\varepsilon\Delta x}{2c}\left\lvert\textbf{A}\right\rvert\right]\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}\Delta x.
> $$
>
> If we define $\textbf{v}=(0,g_{1},\ldots,g_{N})^{\top}\in\mathbb{R}^{N+1}$ and $\hat{\textbf{v}}=\textbf{T}_{f}^{\top}\textbf{v}\in\mathbb{R}^{N+1}$, then we have from Lemma 4
>
> $$
> \mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{A}^{2}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}=\mathcal{D}^{+}\hat{\textbf{v}}^{n+1,\top}_{i+1/2}\textbf{M}^{2}\mathcal{D}^{+}\hat{\textbf{v}}^{n+1}_{i+1/2},
> $$
>
> $$
> \mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\left\lvert\textbf{A}\right\rvert\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}=\mathcal{D}^{+}\hat{\textbf{v}}^{n+1,\top}_{i+1/2}\left\lvert\textbf{M}\right\rvert\mathcal{D}^{+}\hat{\textbf{v}}^{n+1}_{i+1/2},
> $$
>
> and
>
> $$
> \mathcal{D}^{+}\textbf{{g}}^{n+1,\top}_{i+1/2}\textbf{a}\textbf{a}^{\top}\mathcal{D}^{+}\textbf{{g}}^{n+1}_{i+1/2}=\mathcal{D}^{+}\hat{\textbf{v}}^{n+1,\top}_{i+1/2}\textbf{T}_{f}^{\top}\textbf{a}_{f}\textbf{a}_{f}^{\top}\textbf{T}_{f}\mathcal{D}^{+}\hat{\textbf{v}}^{n+1}_{i+1/2}.
> $$
>
> As given in [19, Thoerem 3.2], since $\textbf{T}_{f}^{\top}\textbf{a}_{f}=\frac{1}{\sqrt{3}}\textbf{T}_{f}^{\top}\textbf{e}_{2}=\sqrt{\frac{w_{k}}{3}}P_{1}(\mu_{k})=\sqrt{\frac{w_{k}}{2}}\mu_{k}$, we have
>
> $$
> \displaystyle\mathcal{D}^{+}\hat{\textbf{v}}^{n+1,\top}_{i+1/2}\textbf{T}_{f}^{\top}\textbf{a}_{f}\textbf{a}_{f}^{\top}\textbf{T}_{f}\mathcal{D}^{+}\hat{\textbf{v}}^{n+1}_{i+1/2} \displaystyle=\left(\sum_{k=1}^{N+1}\mathcal{D}^{+}\hat{v}^{n+1}_{i+1/2,k}\sqrt{\frac{w_{k}}{2}}\mu_{k}\right)^{2}
> $$
>
> $$
> \displaystyle=\frac{1}{2}\sum_{k,\ell}^{N+1}\mathcal{D}^{+}\hat{v}^{n+1}_{i+1/2,k}\sqrt{w_{k}}\mu_{k}\mathcal{D}^{+}\hat{v}^{n+1}_{\ell,i+1/2}\sqrt{w_{\ell}}\mu_{\ell}
> $$
>
> $$
> \displaystyle\overset{\text{Young}}{\leq}\frac{1}{4}\sum_{k,\ell}^{N+1}\left(\mathcal{D}^{+}\hat{v}^{n+1}_{i+1/2,k}\right)^{2}w_{k}\mu_{k}^{2}
> $$
>
> $$
> \displaystyle\hskip 18.49988pt\hskip 18.49988pt+\frac{1}{4}\sum_{k,\ell}^{N+1}\left(\mathcal{D}^{+}\hat{v}^{n+1}_{\ell,i+1/2}\right)^{2}w_{\ell}\mu_{\ell}^{2}
> $$
>
> $$
> \displaystyle=\frac{N+1}{2}\sum_{k}^{N+1}\left(\mathcal{D}^{+}\hat{v}^{n+1}_{i+1/2,k}\right)^{2}w_{k}\mu_{k}^{2}.
> $$
>
> Since we can write $\left\lVert\textbf{g}^{n+1}\right\rVert^{2}=\left\lVert\hat{\textbf{v}}^{n+1}\right\rVert^{2}=\sum_{k,i}(\hat{v}^{n+1}_{i+1/2,k})^{2}\Delta x$ we have that (A.16) becomes
>
> $$
> \displaystyle\frac{1}{2\Delta t}\left(e^{n+1}-e^{n}\right) \displaystyle\leq-\frac{\sigma_{0}}{2c}\sum_{k,i}(\hat{v}^{n+1}_{i+1/2,k})^{2}\Delta x
> $$
>
> $$
> \displaystyle+\frac{1}{2}\sum_{k,i}(\mathcal{D}^{+}\hat{v}^{n+1}_{i+1/2,k})^{2}\left[\Delta t\left(\beta_{N}\mu_{k}^{2}+\frac{N+1}{4}w_{k}\mu_{k}^{2}\right)-\frac{\varepsilon\Delta x}{2c}\left\lvert\mu_{k}\right\rvert\right]\Delta x.
> $$
>
> Using Lemma 3 we get $\sum_{i}\left(\mathcal{D}^{+}\hat{\textbf{v}}^{n+1}_{i+1/2}\right)^{2}\leq\frac{4}{\Delta x^{2}}\sum_{i}(\hat{\textbf{v}}^{n+1}_{i+1/2})^{2}$, thus
>
> $$
> \frac{1}{2}\left(e^{n+1}-e^{n}\right)\leq\frac{1}{2}\frac{\Delta t}{\Delta x}\sum_{k,i}(\hat{v}^{n+1}_{i+1/2,k})^{2}\left[\frac{4\Delta t}{\Delta x^{2}}\left(\beta_{N}\mu_{k}^{2}+\frac{1}{4}\beta_{N}\mu_{k}^{2}\right)-\frac{4\varepsilon}{2c\Delta x}\left\lvert\mu_{k}\right\rvert-\frac{\sigma_{0}}{c}\right].
> $$
>
> Hence for ensuring stability we must have for all $k$, where $\mu_{k}\neq 0$,
>
> $$
> \Delta t\leq\frac{1}{5c\beta_{N}}\left(\frac{\sigma_{0}\Delta x^{2}}{\mu_{k}^{2}}+\frac{2\varepsilon\Delta x}{\left\lvert\mu_{k}\right\rvert}\right).
> $$
>
> We note that $\beta_{N}$ remains bounded for all $N$. ∎

## Appendix B Proof of Lemma 1

> **Proof**
>
> As the SVD of $\widehat{\textbf{S}}^{\text{rem}}=\textbf{U}\boldsymbol{\Sigma}\textbf{W}^{\top}$ (4.17) where **U** and **W** are orthogonal, we have
>
> $$
> \widehat{\textbf{U}}^{\top}\left(\widehat{\textbf{S}}^{\text{rem}}\right)^{-\top}=(\widehat{\textbf{U}}^{\top}\textbf{U})\boldsymbol{\Sigma}^{-\top}\textbf{W}^{\top}=(\textbf{S}^{\text{rem}})^{-\top}\widehat{\textbf{W}}^{\top}.
> $$
>
> Consider
>
> $$
> \displaystyle\widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix} \displaystyle=\widehat{\textbf{K}}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\textbf{X}^{\text{ap}}\textbf{S}^{\text{ap}}&\widehat{\textbf{X}}^{\text{rem}}\widehat{\textbf{S}}^{\text{rem}}\end{bmatrix}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\textbf{X}^{\text{ap}}&\widehat{\textbf{X}}^{\text{rem}}\end{bmatrix}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{S}}^{\text{rem}}\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\textbf{X}^{\text{ap}}&\widehat{\textbf{X}}^{\text{rem}}\end{bmatrix}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{U}}\end{bmatrix}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}
> $$
>
> where we use that $\widehat{\textbf{S}}^{\text{rem}}\widehat{\textbf{W}}=\widehat{\textbf{U}}\textbf{S}^{\text{rem}}$. We have from (4.18) that the updated spatial basis matrix has the form $\textbf{X}^{n+1}\textbf{R}_{2}=\begin{bmatrix}\textbf{X}^{\text{ap}}&\textbf{X}^{\text{rem}}\end{bmatrix}=\begin{bmatrix}\textbf{X}^{\text{ap}}&\widehat{\textbf{X}}^{\text{rem}}\widehat{\textbf{U}}\end{bmatrix}$ and thus
>
> $$
> \widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}=\textbf{X}^{n+1}\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}.
> $$
>
> Hence we get the following relation
>
> $$
> \displaystyle\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}^{\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix} \displaystyle=\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}^{\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{X}}^{n+1,\top}\widehat{\textbf{X}}^{n+1}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\textbf{S}^{\text{ap},\top}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem},\top}\end{bmatrix}\textbf{R}_{2}^{\top}\textbf{X}^{n+1,\top}\textbf{X}^{n+1}\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\begin{bmatrix}\textbf{S}^{\text{ap},\top}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem},\top}\end{bmatrix}\textbf{R}_{2}^{\top}\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}.
> $$
>
> Putting it all together we have
>
> $$
> \displaystyle\textbf{R}_{2}^{-\top}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-\top}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{U}}^{\top}(\widehat{\textbf{S}}^{\text{rem}})^{-\top}\end{bmatrix} \displaystyle\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\textbf{R}_{2}^{-\top}\begin{bmatrix}(\textbf{S}^{\text{ap}})^{-\top}&\textbf{0}\\
> \textbf{0}&(\textbf{S}^{\text{rem}})^{-\top}\widehat{\textbf{W}}^{\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\textbf{R}_{2}^{-\top}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}^{-\top}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}^{\top}\end{bmatrix}\widehat{\textbf{S}}^{n+1,\top}\widehat{\textbf{S}}^{n+1}\begin{bmatrix}\textbf{I}_{m}&\textbf{0}\\
> \textbf{0}&\widehat{\textbf{W}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\textbf{R}_{2}^{-\top}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}^{-\top}\begin{bmatrix}\textbf{S}^{\text{ap},\top}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem},\top}\end{bmatrix}\textbf{R}_{2}^{\top}\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\textbf{R}_{2}\begin{bmatrix}\textbf{S}^{\text{ap}}&\textbf{0}\\
> \textbf{0}&\textbf{S}^{\text{rem}}\end{bmatrix}
> $$
>
> $$
> \displaystyle=\textbf{S}^{n+1}.
> $$
>
> ∎

## Footnotes

- **†** ^∗Corresponding author.
- **†** Chinmay Patwardhan: chinmay.patwardhan@kit.edu
- **†** Martin Frank: martin.frank@kit.edu
- **†** Jonas Kusch: jonas.kusch@nmbu.no

## References

- [1] John. Howell, M. Menguc and Robert Siegel “Thermal Radiation Heat Transfer (5th ed.)” CRC Press, 2010 DOI: <https://doi.org/10.1201/9781439894552>
- [2] Svein Rosseland “Astrophysik auf atomtheoretischer Grundlage”, Struktur der Materie in Einzeldarstellungen ; 11 Berlin: Springer, 1931
- [3] Shi Jin “Asymptotic preserving (AP) schemes for multiscale kinetic and hyperbolic equations: A review.” In *Lecture Notes for Summer School on “Methods and Models of Kinetic Theory” (M&MKT), Porto Ercole (Grosseto, Italy)*, 2010, pp. 177–216
- [4] J. Hu, S. Jin and Q. Li “Chapter 5 - Asymptotic-Preserving Schemes for Multiscale Hyperbolic and Kinetic Equations” In *Handbook of Numerical Methods for Hyperbolic Problems* **18**, Handbook of Numerical Analysis Elsevier, 2017, pp. 103–129 DOI: <https://doi.org/10.1016/bs.hna.2016.09.001>
- [5] Axel Klar “An asymptotic preserving numerical scheme for kinetic equations in the low Mach number limit” In *SIAM J. Numer. Anal.* **36.5**, 1999, pp. 1507–1527
- [6] Mohammed Lemou and Luc Mieussens “A new asymptotic preserving scheme based on micro-macro formulation for linear kinetic equations in the diffusion limit” In *SIAM J. Sci. Comput.* **31.1**, 2008, pp. 334–368 DOI: [10.1137/07069479X](https://dx.doi.org/10.1137/07069479X)
- [7] Othmar Koch and Christian Lubich “Dynamical Low-Rank Approximation” In *SIAM Journal on Matrix Analysis and Applications* **29.2**, 2007, pp. 434–454 DOI: [10.1137/050639703](https://dx.doi.org/10.1137/050639703)
- [8] Christian Lubich and Ivan. Oseledets “A projector-splitting integrator for dynamical low-rank approximation” In *Bit Numer Math* **54**, 2014, pp. 171–188 DOI: [10.1007/s10543-013-0454-0](https://dx.doi.org/10.1007/s10543-013-0454-0)
- [9] Gianluca Ceruti and Christian Lubich “An unconventional robust integrator for dynamical low-rank approximation” In *Bit Numer Math* **62**, 2022, pp. 23–44 DOI: [10.1007/s10543-021-00873-0](https://dx.doi.org/10.1007/s10543-021-00873-0)
- [10] Gianluca Ceruti, Jonas Kusch and Christian Lubich “A rank-adaptive robust integrator for dynamical low-rank approximation” In *Bit Numer Math* **62**, 2022, pp. 1149–1174 DOI: [10.1007/s10543-021-00907-7](https://dx.doi.org/10.1007/s10543-021-00907-7)
- [11] Gianluca Ceruti, Jonas Kusch and Christian Lubich “A parallel rank-adaptive integrator for dynamical low-rank approximation”, 2023 arXiv:[2304.05660 [math.NA]](https://arxiv.org/abs/2304.05660)
- [12] Gianluca Ceruti, Lukas Einkemmer, Jonas Kusch and Christian Lubich “A robust second-order low-rank BUG integrator based on the midpoint rule” In *arXiv preprint arXiv:2402.08607*, 2024
- [13] Jonas Kusch and Pia Stammer “A robust collision source method for rank adaptive dynamical low-rank approximation in radiation therapy” In *ESAIM: M2AN* **57.2**, 2023, pp. 865–891 DOI: [10.1051/m2an/2022090](https://dx.doi.org/10.1051/m2an/2022090)
- [14] Lukas Einkemmer, Jingwei Hu and Yubo Wang “An asymptotic-preserving dynamical low-rank method for the multi-scale multi-dimensional linear transport equation” In *Journal of Computational Physics* **439**, 2021, pp. 110353 DOI: <https://doi.org/10.1016/j.jcp.2021.110353>
- [15] Jonas Kusch, Benjamin Whewell, Ryan McClarren and Martin Frank “A low-rank power iteration scheme for neutron transport criticality problems” In *Journal of Computational Physics* **470** Elsevier BV, 2022, pp. 111587 DOI: [10.1016/j.jcp.2022.111587](https://dx.doi.org/10.1016/j.jcp.2022.111587)
- [16] Gianluca Ceruti, Martin Frank and Jonas Kusch “Dynamical low-rank approximation for Marshak waves”, 2022 DOI: [10.5445/IR/1000154134](https://dx.doi.org/10.5445/IR/1000154134)
- [17] Lena Baumann, Lukas Einkemmer, Christian Klingenberg and Jonas Kusch “Energy stable and conservative dynamical low-rank approximation for the Su-Olson problem”, 2023 arXiv:[2307.07538 [math.NA]](https://arxiv.org/abs/2307.07538)
- [18] Lukas Einkemmer, Jingwei Hu and Yubo Wang “An asymptotic-preserving dynamical low-rank method for the multi-scale multi-dimensional linear transport equation” In *J. Comput. Phys.* **439**, 2021, pp. Paper No. 11035321 DOI: [10.1016/j.jcp.2021.110353](https://dx.doi.org/10.1016/j.jcp.2021.110353)
- [19] Lukas Einkemmer, Jingwei Hu and Jonas Kusch “Asymptotic-Preserving and Energy Stable Dynamical Low-Rank Approximation” In *SIAM Journal on Numerical Analysis* **62.1**, 2024, pp. 73–92 DOI: [10.1137/23M1547603](https://dx.doi.org/10.1137/23M1547603)
- [20] Axel Klar and Christian Schmeiser “Numerical passage from radiative heat transfer to nonlinear diffusion models” In *Math. Models Methods Appl. Sci.* **11.5**, 2001, pp. 749–767 DOI: [10.1142/S0218202501001082](https://dx.doi.org/10.1142/S0218202501001082)
- [21] Lukas Einkemmer, Alexander Ostermann and Carmela Scalone “A robust and conservative dynamical low-rank algorithm” In *Journal of Computational Physics* **484**, 2023, pp. 112060 DOI: <https://doi.org/10.1016/j.jcp.2023.112060>
- [22] Lukas Einkemmer, Jonas Kusch and Steffen Schotthöfer “Conservation properties of the augmented basis update & Galerkin integrator for kinetic problems”, 2023 arXiv:[2311.06399 [math.NA]](https://arxiv.org/abs/2311.06399)
- [23] Julian Koellermeier, Philipp Krah and Jonas Kusch “Macro-micro decomposition for consistent and conservative model order reduction of hyperbolic shallow water moment equations: A study using POD-Galerkin and dynamical low rank approximation”, 2023 arXiv:[2302.01391 [math.NA]](https://arxiv.org/abs/2302.01391)
- [24] Kenneth Case and Paul Zweifel “Linear transport theory” Addison-Wesley, 1967
- [25] Shi Jin and Hanqing Lu “An asymptotic-preserving stochastic Galerkin method for the radiative heat transfer equations with random inputs and diffusive scalings” In *Journal of Computational Physics* **334**, 2017, pp. 182–206 DOI: <https://doi.org/10.1016/j.jcp.2016.12.033>
- [26] Bingjing Su and Gordon. Olson “An analytical benchmark for non-equilibrium radiative transfer in an isotropically scattering medium” In *Annals of Nuclear Energy* **24.13**, 1997, pp. 1035–1055 DOI: <https://doi.org/10.1016/S0306-4549%2896%2900100-4>
- [27] Chinmay Patwardhan, Jonas Kusch and Martin Frank “Numerical testcases for "Asymptotic-preserving and energy stable dynamical low-rank approximation for thermal radiative transfer equations"”, 2024 URL: <https://github.com/chinsp/publication-Asymptotic-preserving-and-energy-stable-DLRA-for-thermal-radiative-transfer-equations.git>
