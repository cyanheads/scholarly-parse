# Closed-form spin-relativistic corrections from the Dirac equation enabling a modified Schrödinger solver

Mário B Amaro, Nazeef, Camille J Dussech, Chong Qi  
*Scientific Reports*, 2025, 16, 94  
DOI: 10.1038/s41598-025-29243-4 · PMID: 41423664 · PMCID: PMC12765018  
License: Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to…

## Abstract

We revisit the non-relativistic limit of the Dirac equation in finite scalar and vector potentials and derive a Schrödinger-like equation that retains leading spin–relativistic corrections in closed form. For general central potentials, we cast the radial equation into a quadratic eigenvalue problem (QEP) using a finite-difference discretization method and develop an open-source solver to address it. We study Coulomb, harmonic oscillator, Woods–Saxon, and Yukawa potentials. We further obtain first-order energy and wavefunction corrections for the three-dimensional isotropic harmonic oscillator and Coulomb potentials via perturbation theory. This framework provides a practical bridge between non-relativistic and fully relativistic treatments, enabling accurate quantification of relativistic effects without the computational cost of full four-component calculations.

**Subject terms:** Mathematics and computing, Physics

## Introduction

The Dirac equation, introduced nearly 100 years ago in 1928, represents the most successful attempt to incorporate the effects of special relativity into quantum mechanics in describing the behaviour of spin-1/2 particles. One fundamental departure from the standard Schrödinger equation is that the Dirac equation describes particles with 4-component spinors (two bi-spinors) instead of scalar wavefunctions . Nevertheless, the product is positive-definite, and is still associated with the particle probability density[1]. That can be compared to the Born’s postulate of quantum mechanics that the wave function product defines the probability density of finding a particle at position *r* and time *t*. It may be interesting to mention that, in the de Broglie–Bohm interpretation of quantum mechanics (Bohmian mechanics), the link between the probability density and the wave function appears naturally as a result of the dynamic consequences of the quantum equilibrium hypothesis.

It may be interesting to mention that the Dirac equation for a free particle reduces to the Schrödinger equation in the non-relativistic limit where the 4-component spinors acquire the approximate form

where both and are two-component spinors. The spinor has the explicit form

with

where and is a constant normalized Pauli spinor. The two-component spinors and are often respectively referred to as the large and small components of the Dirac wave functions. approaches the non-relativistic wave function as energy decreases while vanishes. In a recent work by Wilczek and Yu[2], it is argued that the usual identification of as the probability density is conceptually unsatisfactory as the product contains a relativistic correction in the form

A fundamental consequence is that the density thus defined will never vanish, except at infinity, as one can not have the wave function and its derivative approach zero at the same time.

The studying of the relativistic effects on electron probability density has played an important role in many field of fundamental physics studies including quantum field theory, subatomic physics and nuclear astrophysics. The Dirac equation incorporates relativity inherently. One often studies the relativistic effect by comparing the solutions of the Dirac and Schrödinger equations. There has been long-standing interest in not only solving the Dirac equation but also deriving its non-relativistic limits (see, for examples, Ref[3–5].). But it should be clarified that not all “relativistic corrections” arising from the Dirac equation are purely kinematic; some originate from its spinor structure, which introduces new spin physics beyond relativistic kinematics. The purpose of this paper is to reinvestigate the non-relativistic limit of the Dirac equation for particles in a finite potential and to explore the effect of these spin-relativistic correction terms to the Schrödinger equation that arise in this limit, leading to a good bridge between non-relativistic and fully relativistic treatments that can be employed whenever moderate but non-negligible relativistic effects must be quantified, without having to resort to a full relativistic treatment, which introduces computational complexity. We will show that a closed-form Schrödinger-like equation can be derived from taking the non-relativistic expansion of the Dirac equation. The modified equation contains non-linear terms but can be solved using the finite–difference method, with which the system is transformed into a quadratic eigenvalue problem (QEP). Unlike usual perturbation studies, the solving of the QEP matrix gives us consistently the non-relativistic corrections to the energies, wave functions, as well as the probabilistic density.

There is a wide literature of semi-relativistic approximation schemes to the Dirac equation to decouple large and small components and deliver a two or one component Hamiltonian with relativistic effects retained at a controlled cost. Foldy-Wouthuysen and the related Direct Perturbation Theory perform unitary block-diagonalizations order-by-order yielding Pauli-like effective Hamiltonians. Douglas-Kroll-Hess perturbation theory refines this with a sequence of transformations constructed to treat scalar potentials more gently and to converge more smoothly at higher orders. The methods discussed so far are perturbative methods with tunable order and broad reliability, but by no means the only options. By contrast, Barysz-Sadlej-Snijders method constructs an energy-independent decoupling that is exact at the one-electron level, and then adds corrections for two-electron terms, leading to a compact, near-exact two-component model. Other lighter and more approximate methods exist, such as the zeroth-order regular approximation (ZORA), which eliminates the small component via a low-order regularization of the kinetic-balance ratio. This last method is cheap at the cost of being the most approximate. Many other methods exist in the literature. A good overview of these methods can be found in works such as the textbooks by Dyall and Fægri[6] and Reiher and Wolf[7]. The approach explored in this work retains the leading spin-relativistic operators explicitly in a Schrödinger-like equation and collects momentum-dependent pieces into an energy and potential-dependent effective mass, solvable via a QEP. It may also be interesting to mention that in the area of precision molecular physics, there are interest in high-precision evaluation of leading-order relativistic and QED corrections which has been explored with parts-per-million accuracy using explicitly correlated basis functions and regularization techniques[8–10].

## Derivation from Dirac Hamiltonian

We start with a general Dirac Hamiltonian with scalar potential S and vector potential V:

where *m* is the mass of the particle, *E* is the energy and

It can be written in a simpler matrix form as

which gives us two coupled equations

where we have taken

The equations can be written in second derivative form as

Taking the non-relativistic limit:

the above equation can be rewritten as

Using Taylor series expansion, the equation can be approximated as

From now on, we will replace with *E* for simplicity as we focus on the non-relativistic regime. The above equation can be further rewritten as

By expanding the fourth term on right side in the form

and by replacing

we have

So, as an operator:

The so-called Darwin term is often considered in non-relativistic studies[11,12]. Considering that and may not commute, the first term up to the second order term is given by

where

and the double commutator is

For the second term:

Combining both terms above, we get the full expansion:

We reach the final form of the Schrödinger equation-like non relativistic limit of the Dirac equation

which includes, as expected, the standard Schrödinger equation terms as well as energy- and potential-dependent relativistic correction terms.

The Darwin term appears in some Schrödinger-equivalent potential derived from the Dirac equation including for examples Refs[13–15].. The Darwin term is generally small compared to the central and spin-orbit terms. It may be interesting to point out that the Darwin ends up as a constant correction for a harmonic oscillator, which can therefore be neglected, and a surface correction for a Woods-Saxon potential. For the Coulomb potential, it is known to acquire a Dirac function form which affects only the *s* wave at the origin.

Now we would like to re-express the equation in explicit second derivative form. We will be now writing the equation explicitly. We assume spherical symmetry and that the potentials only dependent on the radius. In spherical coordinates, we have for any function *f*

Therefore, we have for the second correction term

which represents the spin-orbit coupling, and can be written in the more known form as

We can define an operator , as often done in the solving of the Dirac equation, in the form

The eigenvalues of are such that, , if and if . Given that operator acts on spin spherical harmonics , as follows:

The fourth correction term for the upper spinor is:

The fifth term can be rewritten as

where we applied the following property:

The sixth term is:

The non-relativistic limit of the Dirac equation in spherical polar coordinates:

where it may be useful to remind that contains two components and that for standard operator one has

We can thus separate the form of 21 into radial (*R*(*r*)) and angular () components. Collecting all the terms with the radial component, multiplying them by

The third term above is exactly the inverse of the effective mass given in the following section, in Equation 60, multiplying the equation by and equating the radial terms to the separation constant

Dividing the whole by we arrive at

We have considered both potentials *S* and *V* in our derivation. It may be interesting to mention that both the concepts of spin and pseudospin symmetries are often discussed in relativistic quantum mechanics. Spin symmetry arises in the Dirac equation when the difference between the vector and scalar potentials, , is approximately constant, , while pseudospin symmetry appears when the sum of the potentials, , is nearly constant, [16]. These symmetries are typically understood as emerging from the decoupling of the large and small components of the Dirac spinor, leading to degenerate doublets in the spectrum.

In our formulation, we focus on the modified Schrödinger equation obtained in the non-relativistic limit which retains the spin–orbit and Darwin terms explicitly in closed analytical form, without requiring the restrictive assumptions that are usually imposed to achieve exact spin or pseudospin symmetry. This approach therefore allows for a broad class of potentials and provides a flexible framework to study relativistic corrections and fine-structure effects in systems where spin and pseudospin symmetry may be only approximate or partially realized (see, for example, Ref[17]. and references therein).

### Analytical solutions

The modified Schödinger equation distilled from the Dirac equation(for a purely radial potential), can be expressed as below second-order differential equation

where,

For , the function is chosen such that the first-order term disappears from the differential equation. In the following discussion, we treat the effective mass as a constant and use it to construct as

substituting this in Equation 26 we get,

The above equation is valid for a general potential dependent on r except for a Coulomb-like potential with inverse r dependence. The differential equation for such a potential is given below

Both the above equations are in Schrödinger-like equation form

depending on the chosen potential, such equations may admit exact or quasi-exact solutions. We have demonstrated how analytical solutions for the Harmonic oscillator and the Coulomb potentials can be derived in the following subsections along with their Perturbative analysis in the next section.

#### Harmonic oscillator

When affected by a Harmonic oscillator potential such as Equation 29 becomes,

We introduce to write the coefficient of in a succinct form,

Expressing derivatives in *r* as primed quantities, Equation 32 becomes

Now, observing the asymptotic behaviour of this equation for , Equation 34 reduces to

The form of the equation suggests that the solution exhibits Gaussian-like behaviour in the limit of large *r*,

Similarly, at the limit *r* is very small, Equation 34 reduces to

In this limit, the solution takes the form

Combining the results from asymptotic analysis gives a general solution of the form

expressing as a power series

and substituting the expression for in Equation 34, we get a recurrence relationship,

The above recurrence relation enables us to find the expression for energy levels

The recurrence equation is exactly that of an associated Laguerre polynomial, hence can be succinctly expressed as

The exact solution for *R*(*r*) can be expressed by multiplying (from Equation 28) and *u*(*r*),

#### Coulomb potential

When potential , where is the fine-structure constant times the atomic number *Z*, is substituted in Equation 30,the equation for all points except , takes a Doubly-Confluent Heun equation form,

The above equation is also of the Kratzer-like potential Schrödinger equation () form

where the corresponding coefficients are

A broad class of exactly and quasi-exactly solvable models has been established through algebraic and analytical methods[18–20]. There were also studies on general conditions for obtaining polynomial solutions of second-order differential equations[21] and solvable Schrödinger potentials using confluent Heun functions[22]. Refs[23,24]. applied these principles to relativistic wave equations including the Dirac and Duffin–Kemmer–Petiau formulations which suggest that solvable structures persist in quantum-corrected and spin-one settings. To derive the quasi-exact solution, we introduce the following transformation:

where,

such that and . After substituting values of and in Equation 48, we get , for the condition to always be true, *k* takes the value . The Hamiltonian can now be expressed as ,

where,

This Hamiltonian can be expressed as a quadratic combination of generators of an set

if is of the form,

The generators of the set are

Using the relation introduced by Equation 52, we can derive the expression for energy levels

The ability to construct the Hamiltonian in terms of quadratic combinations of generators implies that it leaves invariant an -dimensional finite vector space. Hence, preserves the finite-dimensional space of polynomials of degree at most *n*,

Substituting the value of in *u*, followed by evaluating the Hamiltonian equation, we get a three-term recurrence relation,

with . Finally, the radial part of the wavefunction *R* can be expressed as product of and *u*,

In the limit , , it follows that . In this regime, the radial solutions given by equations 43 and 57 reduce to their corresponding solutions of the Schrödinger equation.

### Effective mass

We will refer to the non-relativistic limit of the Dirac equation with the correction terms as the modified Schrödinger equation for simplicity. The modified equation can be simplified by considering specific terms to be contributing to an effective mass:

Using again the Taylor expansion, we have:

### Probability density

The general Dirac Spinor for a particle in a finite potential has now the form

The Dirac density probability is:

Taking again the non-relativistic limit:

we then have

In our derivation above, we considered the general Dirac Hamiltonian containing both scalar *S*(*r*) and vector *V*(*r*) potentials to ensure formal completeness. For the applications discussed below, primarily atomic and electronic systems where relativistic effects are most relevant, the scalar term is either negligible or can be effectively absorbed into the mass term. Therefore, we focused on the case (or equivalently ) to emphasize the physically dominant vector potential contribution.

The derivation, however, remains fully general, and the inclusion of a finite scalar potential is straightforward by reintroducing *S*(*r*) through the definitions and . Such scalar contributions are mainly relevant in nuclear, hypernuclear, or quark-level systems, where Lorentz-scalar couplings modify the rest mass. Extending the present framework to those regimes would require a more elaborate treatment of the poorly constrained vector and scalar potentials.

## Perturbation corrections

### Harmonic oscillator

Despite the added complexity, it is of interest to search for analytical solutions to Equation 24, which can be done by identifying it as a Schrödinger equation with correction terms, allowing us to employ perturbation-theoretical methods to find good analytical approximations. In this section, we apply this method to find approximate analytical expressions for the useful case of the harmonic oscillator. We start by taking simply a vector potential and no scalar potential such that , and therefore Equation 24 becomes

Since the term has an explicit *E* and *V* dependence, we substitute its form back in Equation 62, together with the form of the potential and arrive at

It is now of interest to reorganize this result into two parts. One is an unperturbed Hamiltonian that corresponds to the standard harmonic oscillator pieces and a perturbation Hamiltonian that contains the extra terms. We have that

which gives us the zeroth order energy as the usual eigenvalues of the harmonic oscillator, given by

with *n* and *l* the radial and angular quantum numbers, respectively. As for the perturbation, we have

Working to first order in our small expansion parameter, and keeping in mind that is much smaller than *m*, we can make a series of observations. Firstly, we can take in terms that multiply an expectation value or that serve as correction factors the approximation

Secondly, we assume the terms involving *dR*/*dr* to vanish upon integration by parts under the standard boundary conditions. This allows us to, for the purpose of computing the first-order corrections, work only with

The time-independent perturbation theory tells us that

And therefore

Here, a series of simplifications are possible, namely the fact that via the virial theorem for the harmonic oscillator, one finds that

and therefore the first term adopts the neat form

and therefore we finally find

where the fourth moment computed in the unperturbed state can usually be expressed in a closed form as a function of the quantum numbers. As for the first-order correction to the radial wavefunction, we have the standard formula

where is given by the form of Equation 68. Exploiting the orthogonality of the oscillator eigenfunctions, one can deduce that only the and pieces will contribute to the wavefunction correction as the constant pieces in would yield matrix elements proportional to , which is vanishing for . Therefore, the first-order correction to the wavefunction is given by Equation 74 using an effective Hamiltonian

### Coulomb potential

Using the same approach as for the Harmonic Oscillator, we shall now derive the perturbation correction for the case of a Coulomb potential, given by:

This yields a perturbation of the form

where we define for the sake of compactness

The last term is the Darwin term, which is henceforth omitted, as we shall evaluate the energies for for which the Dirac delta function term will have no contribution. Using Equation 74:

Let us first focus on the initial bracketed term. Since

one finds that

For a Coulomb potential, the radial wavefunction behaves as , which vanishes as due to the exponential decay. Near the origin, the behavior is so as for all . Let us now examine the second bracketed term:

Therefore, we find the energy correction to be

## Numerical implementation

In order to study the prevalence of the effects described in the previous section, a numerical implementation of Equation 24 was developed. The enforcing of the wavefunction boundary conditions is significantly simplified if we introduce a variable change , leading to

For , we can simply impose that the wavefunction vanish. The main advantage of this variable change is that, for , *R*(*u*) is strictly zero, while for *R*(*r*) is simply finite, and a non-zero boundary condition would have to be enforced. As shall be seen, our numerical implementation employs the Finite Difference Method (FDM), where zero Dirichlet boundary conditions are convenient.

### Finite Difference Method (FDM)

The Finite Difference Method (FDM) is the name given to a series of techniques that rely on discretizing the parameter space in a mesh and approximate derivatives using finite differences, effectively reducing the problem to a linearized version of itself, making it significantly simpler[25]. This has the advantage of allowing the usage of highly optimized matrix operation routines to solve the problem in a time- and resource-efficient way. With a sufficiently small step between grid points, the derivatives are well-approximated by the finite differences. The discretization of the parameter space is most often done using a uniform spacing, although methods of discretization for arbitrarily spaced meshes exist as well (e.g[26][27][28].). In this work, a uniform spacing was used. A typical approach would be the use of second-order accuracy central first- and second-order derivatives of *u*(*r*)

where we let *h* denote the step of the mesh. However, in order to increase the accuracy of the solver, we can increase the number of mesh points to the left and right of the point of interest that we involve in the calculation, effectively increasing the accuracy of the finite difference. Let *m* and *n* be the number of points to the left and right of *i*, be coefficients obtained by solving the system from the Taylor expansion and q the order of accuracy, we can derive finite differences of arbitrary order of accuracy to approximate the p-th derivative of *u*(*r*) at point *i* by expanding in a Taylor series around as

In this work, we opted for a five-point central difference scheme (). This increases the accuracy significantly from the simple near-neighbor three-point scheme, and is a usual technique to avoid the well-known spurious state problem that arises in FDM approaches to the Dirac equation[29][30], and should also arise in its non-relativistic limit[31].

The FDM has been extensively employed in the field, namely in numerical implementations of the Schrödinger[32][33][34] and Dirac[35][29][30] equations, in both time-dependent and -independent contexts. Other common numerical methods include Runge-Kutta 4[36][37], and specifically for the more intricate Dirac equation methods such as mapped Fourier method[38], Green’s function method[39][40], evolutionary algorithms[41] or power-series expansion[42] among others have been employed.

### Numerical method

One immediately sees that Equation 84, equipped with the respective boundary conditions, is an eigenvalue problem with eigenfunction *u*(*r*) and respective eigen energies *E*, which can be solved after finite-difference discretization as a matrix eigenvalue problem. It should be noted, however, that the factor , defined in Equation 60, also includes an *E* term. Therefore, the term of Equation 84 where and *E* are multiplied is effectively quadratic in *E*, meaning that we are dealing with a Quadratic Eigenvalue Problem (QEP), a special case of non-linear eigenvalue problem. For a survey of this method see e.g[43].. Upon explicit substitution of Equation 60 onto Equation 84, we are able to write it in an eigenvalue form

Upon discretization, the resulting linear systems can be written as matrices. Let *N* be the number of points of the mesh, then *A*, *B* and *C* will become matrices. Note that, due to the boundary conditions that we enforce, we know that , meaning that the first and last rows and columns of the matrices , and can be casted away and the matrices can be reduced to their non-trivial core.

The method was implemented in Python, where the standard numerical computation libraries such as NumPy[44] or SciPy[45] don’t feature solvers for nonlinear eigenvalue problems. Since, as aforementioned, the main reason for using the FDM is the possibility to exploit the highly optimized linear algebra algorithms featured in these packages, one can transform our current problem into a generalized eigenvalue problem, which is supported, and solve that one instead. Starting from our current form

and by employing an auxiliary vector , we get

where , which can now be solved as a generalized eigenvalue problem using the routines in the aforementioned libraries. It should also be noted that, as usual in FDM implementations, the resulting matrices are sparse matrices, contributing to the numerical efficiency of the eigenvalue problem solving routines. Nonetheless, solving a quadratic eigenvalue problem is significantly more computationally demanding than the usual eigenvalue problem. The main reason for this is that the generalized linear problem that we obtained in Equation 90 increases the cost from to . We therefore end up with a matrix with twice the size, and twice the number of eigenvalues, and hence twice the spectral work. It should also be noted that the newly obtained form is non-Hermitian, which requires the usage of more complex algorithms.

Due to the fact that we are discretizing the space using a uniform grid with constant spacing, one must be attentive to the fact that some states can end up poorly resolved at the lower-*r* end, at distances of the order of magnitude of the step size. If neglected, this can hinder the retrieval of their wavefunctions and energies of deep states such as . In order to ensure that the results in the following section are accurate, we wrote a second code with logarithmic spacing to cross-check that the energy levels and wavefunctions were exactly reproduced in both, ensuring that the results were robust and not resolution-dependent.

### Numerical results

One expects the contribution of the relativistic corrections to be extremely subtle for low energies, which was put to test as both a benchmark and sanity check using the electronic state of the Hydrogen atom, with a binding energy of about . To retrieve it, a Coulomb potential was employed, with the familiar form

with *e* the elementary charge, the vacuum permittivity and *Z* the number of protons in the nucleus. Note that we are using the unit or for distance. This is depicted in Fig. 1 (Top), where the standard radial Schrödinger equation solution and the numerical solution to the corrected form derived in this work are plotted against each other. They are virtually indistinguishable, as expected. Nonetheless, there is a small correction, which is easily seen in Fig. 1 (Bottom), where the standard wavefunction was subtracted from the corrected one. It is interesting to notice that the correction, although small, gives us some insights on the effect of the corrections: where the standard wavefunction vanishes, the corrected one is non-vanishing, since a contribution appears due to the term in Equation 1.

**Fig. 1.** (Top) Comparison of the Hydrogen state probability density solved using both the standard Schrödinger equation and the modified form described in this work; (Bottom) Magnitude of the correction, given by the difference between the corrected and standard probability densities. The effect of the correction terms is negligible, as expected.

As expected, relativistic corrections are negligible in Hydrogen but become substantial for heavy nuclei such as Lead and superheavy ones like Oganesson. We investigate this by comparing the wavefunctions and probability densities for both modified (as introduced in this work) and standard Schrödinger equations, as well as the large component of the Dirac equation using a series of different potentials. Firstly, we study Lead using a Coulomb potential Lead, treating it as a hydrogenic atom. We also investigate Oganesson using a Yukawa screening potential. For heavier atomic systems, one often considers to introduce effective Coulomb potentials of various form to account for effect from the electron screening, exchange, and self-consistency (see, for example, Ref[46].). To further investigate our formalism in a more general view, we also study the effects on systems with a Woods-Saxon potential and harmonic oscillator potential. A few selected states of each potential are provided in Fig. 2, and a brief description and discussion on each of the potentials follows in the next subsections.

**Fig. 2.** Comparison between selected wavefunctions (left column) and probability densities (right column) across the four studied potentials: (**a**,**b**) Coulomb ; (**c**,**d**) Yukawa ; (**e**,**f**) Woods–Saxon ; (**g**,**h**) Harmonic Oscillator .

Regarding the scope and accuracy, one should note the limits of the applicability of this formalism. Firstly, the effective-mass expansion in Equation 60 is valid in the regime , and degrades as the binding gets very deep or grows (i.e., the potential becomes steeper). Furthermore, we note that for s states the relative energy error is slightly higher, decreasing with increasing . The accuracy is also dependent on the type of potential. As a rule of thumb, the formalism is quantitatively reliable for moderate-Z and gently varying central fields, and for sharper potential and higher-Z systems, the higher-order terms become increasingly relevant. Even in that regime, the formalism remains qualitatively correct, since we recover the nodal smearing due to Equation 1 even in those limits.

#### Coulomb potential

In order to study the corrections in a Coulomb potential (Equation 91), we use Pb () as a case study. This is a heavy element for which relativistic corrections are already noticeable for the deeper states. We have solved for this potential using Dirac, Schrödinger and our modified Schrödinger with spin-relativistic corrections, and compared the energies of various states obtained using the three formalisms, which are tabled in the Appendix section. The wavefunction and probability density for a selected state is provide in the top two panels of Fig. 2, for reference. The spin-relativistic-corrected Schrödinger form explored in this work very neatly reproduces the large component of the Dirac equation, showing the effectiveness of the correction terms in bridging the two formalisms.

#### Yukawa potential

The next potential that was studied was a Yukawa potential. It would also be of interest to look at an example of system where corrections would be very significant. Therefore, using this potential, we modelled Oganesson (), the largest superheavy element synthesized as of the development of this work. We consider this to be a particularly relevant case, especially in a time when the study of superheavy elements such as those beyond and the influence of relativistic effects in their physicochemical structure is an active and interesting field of research aligned with NuPECC’s Long Range Plan for European Nuclear Physics[47]. It is well known that Oganesson is heavy enough that relativistic corrections become extremely important, as well as a series of corrections namely Breit and QED contributions, vacuum polarization, among others[48]. Therefore, the simplistic Coulomb potential approach we used before becomes rather unfitting, and more robust methods are necessary to discuss its electronic shell structure[49]. Nonetheless, recent results seem to indicate that in superheavy elements the single-electron wave function is fairly similar to the bare electron wave function after the screening effect is taken into account[50]. Therefore, for a reasonable order-of-magnitude comparison, we model Oganesson via a Yukawa potential

with *a* a Thomas–Fermi screening length given by

The obtained energy levels, compared with those retrieved from Dirac and the standard Schrödinger equation, can be found in the Appendix, in Table 2. Furthermore, the wavefunction and probability density of an illustrative state are given in the second row of Fig. 2. Note that for our Oganesson model, the deep states are highly relativistic, and therefore the wavefunctions are significantly shifted in relation to the Schrödinger solution, as can be seen by the Dirac solution. The formalism derived in this work reproduces the Dirac solution remarkably well. Namely, the non-vanishing behavior of the probability density in the zeroes of the wavefunction, which is ensured by the second term of Equation 1, is remarkably accurate.

**Table 2.** Selected bound-state energies for a Yukawa potential with (see Equation 92). Columns list principal quantum number *n*, orbital , total *j*, and energies for Schrödinger (Schr.), modified Schrödinger with spin-relativistic corrections (Mod-Schr., this work), and Dirac (large component).

| *n* |  | *j* | Schr. (eV) | Mod-Schr. (eV) | Dirac (eV) |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1/2 | 164461 | 182315 | 229897 |
| 2 | 0 | 1/2 | 30905 | 39891 | 52958 |
| 1 | 1 | 1/2 | 31501 | 54089 | 53947 |
| 1 | 1 | 3/2 | 31501 | 33849 | 33615 |
| 3 | 0 | 1/2 | 7679 | 14808 | 14773 |
| 2 | 1 | 1/2 | 7644 | 14219 | 14892 |
| 2 | 1 | 3/2 | 7644 | 8793 | 9240 |
| 1 | 2 | 3/2 | 7080 | 8266 | 8717 |
| 1 | 2 | 5/2 | 7080 | 7375 | 7352 |
| 4 | 0 | 1/2 | 1395 | 3506 | 3752 |
| 3 | 1 | 1/2 | 1280 | 3218 | 3673 |
| 3 | 1 | 3/2 | 1280 | 1649 | 1926 |
| 2 | 2 | 3/2 | 912 | 1273 | 1548 |
| 2 | 2 | 5/2 | 912 | 1032 | 1145 |
| 1 | 3 | 5/2 | 318 | 429 | 549 |
| 1 | 3 | 7/2 | 318 | 359 | 330 |

### Woods-Saxon potential

In order to investigate the effects of the correction terms in a potential of Woods-Saxon (WS) type, we used the familiar form

scaled to reproduce energies in the order of for ease of comparison with the previous potentials. Naturally, the reproduced energies don’t correspond to electron shells of an atom, since WS is a nuclear potential and cannot reproduce the 1/*r* Coulomb tail, which is much more adequate for atomic purposes. In any case, we consider it to be of academic interest to study the effects of the corrections in this type of potential as well, as it differs only from the nuclear case via a scaling. For this purpose, we used a radius parameter of , diffuseness of and depth of . The energy table can be found in the Appendix, and a comparison between two wavefunctions and probability densities can be found in the third row of Fig. 2.

### Harmonic oscillator

The final type of potential investigated in this work was the Harmonic Oscillator potential. The usual form of the Harmonic Oscillator potential is given by

where *m* represents the mass of the particle, is the angular frequency of the oscillator and *r* is the position. A perturbative analysis of this case has been performed in a previous section, and here we shall focus on the numerical implementation. In order to simulate energies in orders of magnitude comparable with the previous potentials analysed in this work, we have taken and assumed an electron trapped in the potential. We then introduced a shift on the potential by ,with . We do this in order to shift the eigen-energies into a depth at which relativistic corrections become appreciable and comparable to the previous potentials. The wavefunction and probability density of a selected state is provided in the fourth row of Fig. 2 and the energies of selected states can be found in the Appendix.

## Conclusions

In this work we have recovered that the non-relativistic reduction of the Dirac equation, when performed for finite scalar and vector potentials without a prior neglecting order- terms, naturally yields a Schrödinger-type equation augmented by four relativistic operators. Collecting the momentum–dependent pieces into an energy- and potential-dependent effective mass leads to a compact representation, henceforth called the modified Schrödinger equation, that reproduces the conventional Schrödinger dynamics in the limit, while retaining a series of correction terms that start to become relevant as elements become heavier and the respective electron shells more relativistic.

Numerically, casting the radial equation as a quadratic eigenvalue problem and solving it by sparse-matrix linearization within a finite-difference discretization furnishes a stable and computationally inexpensive scheme. We use this method to compute and compare the Schrödinger, Dirac and spin-relativistic-corrected Schrödinger formalisms in terms of their energies and wavefunctions and observe the effect of the corrections and their effectiveness. The method reproduces hydrogenic spectra very precisely, which is expected for low energy orbits, and also exposes sizeable deviations for inner shells of heavy ions. The analysis is extended to Lead and Oganesson, respectively modelled as Coulomb and Yukawa potentials, as well as Woods-Saxon and Harmonic Oscillator-type potentials.

The practical value of the present formulation is three-fold. First, it offers a didactically transparent path from the Dirac formalism to quantitatively reliable wave-functions in atomic, nuclear and condensed-matter problems where relativistic corrections are important but a full four-component calculation is unwarranted. Second, by exposing the effective-mass structure it connects naturally to semi-relativistic models used in band-structure and envelope-function approaches. Third, the quadratic-eigenvalue discretization and subsequent linearization allows a highly optimized implementation using modern sparse-linear-algebra libraries, enabling large-scale simulations on commodity hardware.

## Supplementary Information

**Supplementary material.** Supplementary Information. (file: 41598_2025_29243_MOESM1_ESM.pdf)

## Acknowledgements

CQ acknowledges the computational resources provided by the National Academic Infrastructure for Supercomputing in Sweden (NAISS) at PDC, KTH. We also thank Tao Chen for his effort doing the Dirac Hartree-Fock calculations, Yinu Zhang for noticing the error in the original version of Fig. 2 and Frank Wilczek for a helpful discussion about the work, its relevance and applicability.

### Appendix A: energy level tables

See Tables 1, 2, 3, and 4.

**Table 1.** Selected bound-state energies for a Coulomb potential with (Eq. 91). Columns list *n*, , *j*, and energies for Schrödinger (Schr.), modified Schrödinger (Mod-Schr., this work), and Dirac (large component).

| *n* |  | *j* | Schr. (eV) | Mod-Schr. (eV) | Dirac (eV) |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1/2 | 88769 | 95737 | 100705 |
| 2 | 0 | 1/2 | 22529 | 25208 | 27034 |
| 1 | 1 | 1/2 | 22871 | 26860 | 27234 |
| 1 | 1 | 3/2 | 22871 | 23101 | 23339 |
| 3 | 0 | 1/2 | 10064 | 11332 | 11900 |
| 2 | 1 | 1/2 | 10165 | 11562 | 11973 |
| 2 | 1 | 3/2 | 10165 | 10368 | 10758 |
| 1 | 2 | 3/2 | 10165 | 10493 | 10777 |
| 1 | 2 | 5/2 | 10165 | 10263 | 10245 |
| 4 | 0 | 1/2 | 5675 | 6240 | 6618 |
| 3 | 1 | 1/2 | 5718 | 6342 | 6651 |
| 3 | 1 | 3/2 | 5718 | 5833 | 6131 |
| 2 | 2 | 3/2 | 5718 | 5891 | 6143 |
| 2 | 2 | 5/2 | 5718 | 5791 | 5906 |
| 1 | 3 | 5/2 | 5718 | 5795 | 5912 |
| 1 | 3 | 7/2 | 5718 | 5750 | 5738 |

**Table 3.** Selected bound-state energies for a Woods-Saxon potential with , , (see Equation 94).

| *n* |  | *j* | Schr. (eV) | Mod-Schr. (eV) | Dirac (eV) |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1/2 | 178573 | 178332 | 179047 |
| 1 | 1 | 1/2 | 161800 | 162767 | 163664 |
| 1 | 1 | 3/2 | 161800 | 162373 | 162536 |
| 1 | 2 | 3/2 | 143103 | 145048 | 145951 |
| 1 | 2 | 5/2 | 143103 | 144247 | 144392 |
| 2 | 0 | 1/2 | 139558 | 141779 | 143293 |
| 1 | 3 | 5/2 | 122854 | 126159 | 127040 |
| 1 | 3 | 7/2 | 122854 | 124862 | 125001 |
| 2 | 1 | 1/2 | 118036 | 121523 | 124335 |
| 2 | 1 | 3/2 | 118036 | 121003 | 122942 |
| 2 | 2 | 3/2 | 95811 | 101152 | 104032 |
| 2 | 2 | 5/2 | 95811 | 100208 | 102213 |
| 3 | 0 | 1/2 | 93497 | 99004 | 102504 |
| 3 | 1 | 1/2 | 70477 | 78162 | 82613 |
| 3 | 1 | 3/2 | 70477 | 77301 | 81096 |
| 4 | 0 | 1/2 | 46940 | 56152 | 61431 |

**Table 4.** Selected bound-state energies for a Harmonic Oscillator potential with , (see Equation 95). Columns list principal quantum number *n*, orbital , total *j*, and energies for Schrödinger (Schr.), modified Schrödinger with spin-relativistic corrections (Mod-Schr., this work), and Dirac (large component).

| *n* |  | *j* | Schr. (eV) | Mod-Schr. (eV) | Dirac (eV) |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 1/2 | 169939 | 170305 | 170454 |
| 1 | 1 | 1/2 | 150000 | 151046 | 152142 |
| 1 | 1 | 3/2 | 150000 | 151046 | 150716 |
| 2 | 0 | 1/2 | 129909 | 131166 | 133393 |
| 1 | 2 | 3/2 | 130000 | 131683 | 132928 |
| 1 | 2 | 5/2 | 130000 | 131683 | 131167 |
| 2 | 1 | 1/2 | 110001 | 112912 | 115611 |
| 2 | 1 | 3/2 | 110001 | 112912 | 114132 |
| 1 | 3 | 5/2 | 110000 | 112493 | 113875 |
| 1 | 3 | 7/2 | 110000 | 112493 | 111799 |
| 3 | 0 | 1/2 | 89887 | 92487 | 97236 |
| 2 | 2 | 3/2 | 90001 | 94036 | 96881 |
| 2 | 2 | 5/2 | 90001 | 94036 | 95043 |
| 3 | 1 | 1/2 | 70002 | 75709 | 79933 |
| 3 | 1 | 3/2 | 70002 | 75709 | 78407 |
| 4 | 0 | 1/2 | 49869 | 54021 | 61901 |

## Author contributions

All authors wrote and reviewed the manuscript. CQ and N performed the derivations of the correction terms and probability density, corresponding to Sect. "Derivation from Dirac Hamiltonian". CJD performed the derivations of the perturbation corrections featured in Sect. “Perturbation corrections”. MBA derived the discretized equation for the FDM, wrote the code for the numerical implementation and retrieved the numerical results, corresponding to Sect. “Numerical implementation”. MBA prepared the Figures and Tables. CQ supervised the work. All authors contributed to the revision of the manuscript.

## Funding

Open access funding provided by Royal Institute of Technology. CQ acknowledges the support from the Olle Engkvist Foundation.

## Data availability

The uniform- and logarithmic-mesh solvers developed for the numerical implementation section of this work are openly available as a pack on Zenodo, which can be found on <https://doi.org/10.5281/zenodo.17023934.>

## Declarations

### Competing interests

The authors declare no competing interests.

## Supplementary Information

The online version contains supplementary material available at 10.1038/s41598-025-29243-4.

## Associated Data

### Supplementary Materials

**Supplementary material.** Supplementary Information. (file: 41598_2025_29243_MOESM1_ESM.pdf)

### Data Availability Statement

The uniform- and logarithmic-mesh solvers developed for the numerical implementation section of this work are openly available as a pack on Zenodo, which can be found on <https://doi.org/10.5281/zenodo.17023934.>

## Footnotes

- **✉** Corresponding author.
- **Publisher’s note** Springer Nature remains neutral with regard to jurisdictional claims in published maps and institutional affiliations.

## References

- [1] Greiner, W. Relativistic Quantum Mechanics. Wave Equations (Springer Berlin Heidelberg, 2000) 10.1007/978-3-662-04275-5
- [2] Wilczek, F. & Yu, Z. Probability of presence versus (2024), arXiv:2405.04493 [quant-ph] https://arxiv.org/abs/2405.04493
- [3] Grave de Peralta, L. Exact quasi-relativistic wavefunctions of hydrogen-like atoms, Scientific Reports 10, (2020) 10.1038/s41598-020-71505-w
- [4] Poveda, L. A., Grave de Peralta, L., Pittman, J. & Poirier, B. A non-relativistic approach to relativistic quantum mechanics: The case of the harmonic oscillator, Foundations of Physics 52, (2022) 10.1007/s10701-022-00541-5
- [5] Puchalski, M., Komasa, J. & Pachucki, K. Relativistic corrections for the ground electronic state of molecular hydrogen. Phys. Rev. A95, 052506. 10.1103/PhysRevA.95.052506 (2017).
- [6] Dyall, K. & Faegri, K. Introduction to Relativistic Quantum Chemistry (Oxford University Press, 2007)
- [7] Reiher M. & Wolf, A. Relativistic Quantum Chemistry: The Fundamental Theory of Molecular Science (Wiley, 2009)
- [8] Pachucki, K., Cencek, W. & Komasa, J. On the acceleration of the convergence of singular operators in gaussian basis sets. The Journal of Chemical Physics122, 184101. 10.1063/1.1888572 (2005).
- [9] Jeszenszki, P., Ireland, R. T., Ferenc, D. & Mátyus, E. On the inclusion of cusp effects in expectation values with explicitly correlated gaussians. International Journal of Quantum Chemistry122, e26819. 10.1002/qua.26819 (2022).
- [10] Cioslowski, J. Drachmanization revisited, The Journal of Chemical Physics 163, (2025) 10.1063/5.0273068
- [11] Foldy, L. L. & Wouthuysen, S. A. On the dirac theory of spin 1/2 particles and its non-relativistic limit. Physical Review78, 29. 10.1103/PhysRev.78.29 (1950).
- [12] Sakurai, J. J. Advanced Quantum Mechanics (Addison-Wesley, 1967).
- [13] Müther, H., Sammarruca, F. & Ma, Z. Relativistic effects and three-nucleon forces in nuclear matter and nuclei. International Journal of Modern Physics E26, 1730001. 10.1142/S0218301317300016 (2017).
- [14] Zeng, Z., Chen, B. & Zhao, J. Relativistic corrections to hadron-hadron correlation function (2025), arXiv:2506.19240 [hep-ph]
- [15] Jwailes, M., Barghouthi, I. & Atawnah, Q. Higher-order corrections of the hydrogen-like atoms: the effect of darwin term. Arab Journal of Basic and Applied Sciences32, 175–187. 10.1080/25765299.2025.2521943 (2025).
- [16] Ginocchio, J. N. Pseudospin as a relativistic symmetry. Phys. Rev. Lett.78, 436. 10.1103/PhysRevLett.78.436 (1997).
- [17] Heitz, L., Ebran, J.-P. & Khan, E. Patterns of spin and pseudospin symmetries in nuclear relativistic mean-field approaches. Phys. Rev. C111, 064306. 10.1103/PhysRevC.111.064306 (2025).
- [18] Turbiner, A. Quasi-exactly-solvable problems and algebra. Communications in Mathematical Physics118, 467. 10.1007/BF01466727 (1988).
- [19] Turbiner, A. V. One-dimensional quasi-exactly solvable schrödinger equations. Physics Reports642, 1–71. 10.1016/j.physrep.2016.06.002 (2016).
- [20] González-López, A., Kamran, N. & Olver, P. J. Quasi-exact solvability, in Algebraic Aspects of Integrable Systems: In Memory of Irene Dorfman, Contemporary Mathematics, Vol. 160, edited by A. S. Fokas and I. M. Gel’fand. 113–140 (American Mathematical Society, Providence, RI, 1994).
- [21] Zhang, Y.-Z. Exact polynomial solutions of second order differential equations and their applications. Journal of Physics A: Mathematical and Theoretical45, 065206. 10.1088/1751-8113/45/6/065206 (2012) arXiv:1107.5090.
- [22] Ishkhanyan, A. M. Schrödinger potentials solvable in terms of the confluent heun functions. Theoretical and Mathematical Physics188, 980. 10.1134/S0040577916070023 (2016).
- [23] Baradaran, M., Nieto, L. M., de Oliveira, L. P. & Zarrinkamar, S. The spin-one duffin-kemmer-petiau equation revisited: analytical study of its structure and a careful choice of interaction. Physica Scripta100, 075310. 10.1088/1402-4896/ade2a2 (2025).
- [24] Baradaran, M., Nieto, L. M. & Zarrinkamar, S. Dirac equation with space contributions embedded in a quantum-corrected gravitational field. Annals of Physics478, 170033. 10.1016/j.aop.2024.170033 (2025) arXiv:2408.10598.
- [25] Grossmann, C., Roos, H.-G. & Stynes, M. Numerical Treatment of Partial Differential Equations (Springer. Berlin Heidelberg10.1007/978-3-540-71584-9 (2007).
- [26] Perrone, N. & Kao, R. A general finite difference method for arbitrary meshes. Computers & Structures5, 45–57. 10.1016/0045-7949(75)90018-8 (1975).
- [27] Kadalbajoo, M. K. & Kumar, D. Variable mesh finite difference method for self-adjoint singularly perturbed two-point boundary value problems, Journal of Computational Mathematics , 711 (2010) 10.4208/jcm.1003-m2809
- [28] Amaro, M. B. A practical recipe for variable-step finite differences via equidistribution (2024) 10.48550/ARXIV.2412.05598
- [29] Fang, J.-Y., Chen, S.-W. & Heng, T.-H. Solution to the dirac equation using the finite difference method, Nuclear Science and Techniques 31, 10.1007/s41365-020-0728-6 (2020)
- [30] Zhang, Y., Bao, Y., Shen, H. & Hu, J. Resolving the spurious-state problem in the dirac equation with the finite-difference method, Physical Review C 106, (2022) 10.1103/physrevc.106.l051303
- [31] Tupitsyn, I. I. & Shabaev, V. M. Spurious states of the dirac equation in a finite basis set. Optics and Spectroscopy105, 183–188. 10.1134/s0030400x08080043 (2008).
- [32] Simos, T. & Williams, P. A finite-difference method for the numerical solution of the schrödinger equation. Journal of Computational and Applied Mathematics79, 189–205. 10.1016/s0377-0427(96)00156-2 (1997).
- [33] Sudiarta, I. W. & Geldart, D. J. W. Solving the schrödinger equation using the finite difference time domain method. Journal of Physics A: Mathematical and Theoretical40, 1885–1896. 10.1088/1751-8113/40/8/013 (2007).
- [34] Graen, T. & Grubmüller, H. Nusol - numerical solver for the 3d stationary nuclear schrödinger equation. Computer Physics Communications198, 169–178. 10.1016/j.cpc.2015.08.023 (2016).
- [35] Becker, U., Grun, N. & Scheid, W. Solution of the time-dependent dirac equation by the finite difference method and application for ca20++u91+. Journal of Physics B: Atomic and Molecular Physics16, 1967–1981. 10.1088/0022-3700/16/11/017 (1983).
- [36] Meng, J. Relativistic continuum hartree-bogoliubov theory with both zero range and finite range gogny force and their application. Nuclear Physics A635, 3–42. 10.1016/s0375-9474(98)00178-x (1998).
- [37] Kiessling, A. W., Karlsson, D., Zhao, Y., Amaro, M. B. & Qi, C. Numerical solution of the dirac equation with scalar, vector, and tensor potentials, Nuclear Science and Techniques 36, (2025) 10.1007/s41365-025-01810-4
- [38] Ackad, E. & Horbatsch, M. Numerical solution of the dirac equation by a mapped fourier grid method. Journal of Physics A: Mathematical and General38, 3157 (2005).
- [39] Sun, T. T., Zhang, S. Q., Zhang, Y., Hu, J. N. & Meng, J. Green’s function method for single-particle resonant states in relativistic mean field theory, Physical Review C 90, (2014) 10.1103/physrevc.90.054321
- [40] Sun, T.-T., Qian, L., Chen, C., Ring, P. & Li, Z. P. Green’s function method for the single-particle resonances in a deformed dirac equation, Physical Review C 101, (2020) 10.1103/physrevc.101.014321
- [41] Sturniolo, S. & Hillier, A. Mudirac: A dirac equation solver for elemental analysis with muonic x-rays. X-Ray Spectrometry50, 180 (2021).
- [42] Salvat, F. & Fernández-Varea, J. M. radial: A fortran subroutine package for the solution of the radial schrödinger and dirac wave equations. Computer Physics Communications240, 165. 10.1016/j.cpc.2019.02.011 (2019).
- [43] Tisseur, F. & Meerbergen, K. The quadratic eigenvalue problem. SIAM Review43, 235–286. 10.1137/s0036144500381988 (2001).
- [44] Harris, C. R. et al. Array programming with numpy. Nature585, 357–362. 10.1038/s41586-020-2649-2 (2020).
- [45] Virtanen, P. et al. Scipy 1.0: fundamental algorithms for scientific computing in python. Nature Methods17, 261–272. 10.1038/s41592-019-0686-2 (2020).
- [46] Talman, J. D. & Shadwick, W. F. Optimized effective atomic central potential. Phys. Rev. A14, 36. 10.1103/PhysRevA.14.36 (1976).
- [47] NuPECC, Nupecc long range plan 2024 for european nuclear physics (2025) 10.48550/ARXIV.2503.15575
- [48] Guo, Y., Pašteka, L. F., Eliav, E. & Borschevsky, A. Ionization potentials and electron affinity of oganesson with relativistic coupled cluster method, in New Electron Correlation Methods and their Applications, and Use of Atomic Orbitals with Exponential Asymptotes. 107–123 (Elsevier, 2021). 10.1016/bs.aiq.2021.05.007
- [49] Jerabek, P., Schuetrumpf, B., Schwerdtfeger, P. & Nazarewicz, W. Electron and nucleon localization functions of oganesson: Approaching the thomas-fermi limit, Physical Review Letters 120, (2018) 10.1103/physrevlett.120.053001
- [50] Ravlic, A., Schwerdtfeger, P. & Nazarewicz, W. Electron capture of superheavy nuclei with realistic lepton wave functions, Physical Review C 111, (2025) 10.1103/n6d8-cmcg
