# Advanced soliton structures and elliptic wave patterns in a sixth-order nonlinear Schrödinger equation using improved modified extended tanh function method

DOI: 10.1038/s41598-025-30797-6

## Abstract

In this work, a sixth–order extension of the nonlinear Schrödinger equation (NLSE) within its integrable hierarchy is investigated to model higher–order nonlinear and dispersive effects relevant to optical fiber systems and nonlinear wave propagation. By employing the Improved Modified Extended Tanh Function Method, a comprehensive family of exact analytical solutions is derived, encompassing bright and dark solitons, singular soliton structures, and singular periodic solutions. In addition, solution families expressed in terms of Jacobi elliptic functions, Weierstrass doubly periodic elliptic functions, and exponential profiles are obtained. The novelty of this study lies in extending the analytical framework of the NLSE hierarchy to its sixth–order integrable form and in uncovering new soliton and elliptic wave structures. The obtained results reveal rich nonlinear dynamics associated with higher– order dispersion and nonlinearity and clarify the transition between periodic and localized behaviors. Two– and three–dimensional graphical simulations further illustrate the spatiotemporal evolution of the derived solutions. Overall, the findings deepen the understanding of advanced nonlinear wave mechanisms and offer potential implications for ultrafast optical and nonlinear waveguide systems.

Nonlinear partial differential equations (NPDEs) play a fundamental role in describing complex dynamical processes in nature and technology. Among the most notable nonlinear wave phenomena are solitons—localized and stable wave packets that preserve their shape and velocity over long propagation distances due to the delicate balance between dispersion and nonlinearity. NPDEs also admit other solution types, such as breathers, periodic waves, and rogue waves, the latter being large-amplitude, localized events that appear transiently and capture extreme dynamics in nonlinear systems[1–3]. A canonical mathematical model that governs such behaviors is the nonlinear Schrödinger equation (NLSE), which appears in diverse physical contexts, including nonlinear optics, plasma physics, hydrodynamics, and quantum field theory. Owing to its integrability, the NLSE admits exact analytical solutions and provides deep insights into nonlinear wave dynamics.

Although the classical NLSE has been widely investigated, it fails to accurately model scenarios in which higher–order dispersive and nonlinear contributions play a significant role, particularly in optical fiber systems supporting ultrashort and high–intensity pulses. Therefore, several integrable higher–order generalizations have been introduced. Prominent examples include the Hirota equation, which incorporates third–order dispersion^4, and the Lakshmanan–Porsezian–Daniel (LPD) equation, which accounts for fourth–order effects[5,6]. These extensions preserve integrability while substantially enhancing the physical fidelity of the governing models.

In many modern photonic and quantum systems, wave packets may evolve on time scales comparable to the carrier frequency, where classical approximations such as the slowly varying envelope approximation cease to be sufficient. In such regimes, ultrashort (sub-picosecond or femtosecond) optical pulses[7,8], strongly nonlinear matter waves in Bose–Einstein condensates, and intense Langmuir wave packets in plasma require the inclusion of higher-order dispersive and nonlinear effects^9. In fiber optics, for example, third-order dispersion and self-steepening become significant for picosecond pulses, while fourth- and sixth-order dispersion terms become relevant for femtosecond pulses propagating in photonic-crystal fibers, dispersion-engineered fibers, and microstructured waveguides. These higher-order contributions also capture delayed nonlinear responses, Raman-type effects, and ultrafast saturation of the Kerr nonlinearity.

The hierarchical extension of the NLSE, often referred to as the generalized nonlinear Schrödinger hierarchy, has been developed to characterize systems that require successive higher–order corrections while preserving integrability[10–12]. In this work, we focus on the sixth–order member of this hierarchy, given by This equation generalizes well-known integrable NLSE-type models. Specifically, setting *α*_5 = *α*_6 = 0 yields the LPD equation^3, while *α*_4 = *α*_5 = *α*_6 = 0, recovers the Hirota equation^{10}. Despite the theoretical significance of the sixth-order extension, systematic analytical studies and explicit solution constructions for this model remain scarce in the literature. This motivates the present investigation.

From a physical perspective, the coefficients *α*_3*, α*_4, *α*_5, and *α*_6 represent progressively higher-order dispersive and nonlinear contributions : *α*_3, and *α*_4 is associated with third, and fourth-order dispersion, nonlinear dispersion, and self-frequency shift effects; *α*_5 governs fifth-order nonlinear dispersion and ultrafast self-steepening interactions; and *α*_6 corresponds to sixth-order dispersion and high-order nonlinear responses, which become significant in the propagation of ultrashort pulses where higher-order spectral broadening and nonlinear refractive index saturation occur. Such effects are particularly relevant in the design of high-power fiber lasers, super continuum generation in photonic-crystal fibers, and the manipulation of matter-wave solitons in condensates subjected to higher-order effective interactions.

Recently, many researchers have been actively modifying and applying various ansatz-based methods and analytical techniques to obtain soliton solutions. Among the commonly used methods are the Fan sub-equation method^{13}, the extended simplest equation method^{14}, the new extended auxiliary equation method[15,16], the solitary wave ansatz method^{17}, the Sardar sub-equation method^{18}, the modified extended direct algebraic method[19–21], the improved modified extended tanh function method[22–24], and the Jacobi elliptic function method^{25}, as well as the F-expansion method^{26}. In addition, other effective approaches such as the sine-Gordon method^{27}, the Hirota bilinear method[28–30], and the exp(*ϕ*(*ζ*))-function method^{31} have also been employed to derive analytical soliton solutions.

Several researchers have investigated the stability of soliton solutions using analytical and numerical methods to better understand their dynamical behavior[32,33]. These studies provide insight into the robustness and persistence of solitons under perturbations in nonlinear systems.

## Motivation and research gap

Higher–order NLSE hierarchies are essential for understanding ultrashort pulse propagation and strong nonlinear wave interactions. However, analytical results for the sixth–order NLSE member remain limited. In particular, explicit soliton and periodic solutions, along with their physical characteristics, have not been sufficiently reported. Elucidating the structure of such higher–order solitary waves provides deeper insight into pulse–shaping mechanisms and nonlinear dispersion balances in advanced optical and quantum systems.

## Objective

The main objective of this work is to derive exact closed-form solutions for the sixth-order NLSE hierarchy and analyze the corresponding nonlinear wave structures.

## Method and contributions

To achieve this, we utilize the improved modified extended tanh function method, a powerful symbolic technique for solving nonlinear evolution equations. The major contributions are summarized as follows:

• Analytical investigation of the sixth-order NLSE hierarchy and its physical relevance. • Construction of new exact solutions, including bright, dark, and singular solitons. • Derivation of additional periodic solutions expressed in terms of Jacobi and Weierstrass elliptic functions. • Numerical visualization of selected solutions in 2D and 3D to illustrate propagation dynamics.

## Proposed technique

We briefly outline the steps involved in the improved modified extended tanh function method (IMETFM)[22–24].

First, we assume that the nonlinear partial differential equation can be expressed in terms of *ψ* and its partial derivatives as follows:

P(*ψ, ψ*_t*, ψ*_x*, ψ*_{xt}*, ψ*_{xx}*, . . .*) = 0*.* (2)

To reduce Eq. (2), we assume a traveling wave transformation for the wave envelope

*ψ*(*x, t*) = *ψ*(*ζ*)*,*

where *ζ* = *x* − *νt* with *ν* ̸= 0, which converts the function *ψ* into a function of a single-variable form. Substituting this transformation into Eq. (2) yields the following ordinary differential equation:

P(*ψ, ψ*^{(1)}*, ψ*^{(2)}*, ψ*^{(3)}*, ψ*^{(4)}*, . . .*) = 0*.* (3)

The next step in applying the IMETFM is to assume that the solution of Eq. (3) has the finite series form where *c*^2_N + *c*^2_{−N} ̸= 0, and the function *ϕ* satisfies the extended Riccati equation The integer *N* is determined by applying the homogeneous balance principle, which balances the highest-order derivative term with the highest-order nonlinear term in Eq. (3).

Substituting Eq. (4) into Eq. (3), while taking Eq. (5) into account, results in a polynomial in *ϕ*. By equating the coefficients of the obtained polynomial in *ϕ* to zero, we obtain a system of nonlinear algebraic equations involving the parameters of the original equation, the Riccati equation, and the finite series form. This system can be solved using symbolic computation software such as *Mathematica*.

## Methodology and findings

We now apply the improved modified extended tanh function method to Eq.(1). Assuming the wave envelope as:

*ψ*(*x, t*) = R(*ζ*)*e*^{i(ωt−kx+θ)}*,* (6)

where *ζ* = *x* − *νt*, and *ν*, *θ*, *k*, *ω*, represent the soliton speed, phase constant, wave number, and soliton frequency, respectively. Inserting the wave envelope assumption in Eq. (6) into Eq. (1), then splitting the obtained equation into its real,and imaginary components, then we get the following:

The real component is given by: R −2*α*_6*ω* + 2*α*_5*ω* + 2*α*_4*ω* − 2*α*_3*ω* + 2*k* − *ω* + R 60*α*_6*ω* − 40*α*_5*ω* − 24*α*_4*ω* + 12*α*_3*ω* + 2 + The imaginary component reads: −12*α*_6*νω* + 10*α*_5*νω* + 8*α*_4*νω* − 6*α*_3*νω* − 2*νω* + 2 R + 240*α*_6*νω* − 120*α*_5*νω* − 48*α*_4*νω* + 12*α*_3*ν* R R + 20*α*_5*ν* − 120*α*_6*ν ω* R + 80*α*_5*ν* − 480*α*_6*ν ω* RR R + (60*α*_5*ν* − 360*α*_6*νω*) R R + Equating the coefficients of the imaginary parts to zero, we derive the following relationships:

 _3  216*α*^4 + 810*α*_3*α*_5*α*^2 − 72*α*^3L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*^2 (18*α*^2 + 5L) L − 3*α*_4 *ω* = *,*  10*α*_5  *α*_5(L + 3*α*_4) *α*_6 = *,* 9*α*_3 where L = 9*α*_4^2 + 15*α*_3*α*_5.

Applying the balancing principle by balancing the highest order derivative term R^{(6)} with the highest nonlinear term R^7 in the real part, we obtain that *N* = 1. Consequently, we express R(*ζ*) as:

R(*ζ*) = *c*_0 + *c*_1*ϕ* + *c*_{−1}*ϕ*^{−1}*.* (7)

Substituting Eq. (7) into the real part and considering the extended Riccati equation in Eq. (5), we obtain a polynomial in *ϕ*. By equating the coefficients of this polynomial to zero, we derive different algebraic systems based on the values of *d*_0*, d*_1*, d*_2*, d*_3*, d*_4, which are then solved using Mathematica.

### Localized solitons

When {*d*_0 = *d*_1 = *d*_3 = 0}, we attain the following result. *k* =^1_2 *ω*^2 − 2*ν*^6*d*^3_2*α*_6 + 2*ω*^3 *α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω*^3*α*_6 − *ν d*_2 1 + 6*ωα*_3 − 4*ω* (3*α*_4 + 5*ωα*_5) + 30*ω α*_6 − 2*ν d*_2 *α*_4 + 5*ω*(*α*_5 − 3*ωα*_6) *.*

Then, the preceding solution set admits the following bright soliton. 216*α*_4 − 72L*α*_4 + 810*α*_3*α*_5*α*_4 − 15*α*_5 (14L*α*_3 + 25*α*_5) *α*_4 + 25 (18*α*_3 + 5L) *α*_5 When {*d*_1 = *d*_3 = 0, *d*_0 =_{4d4} }, we attain the following result. *k* =^1_2 − 5*ν*^6*d*^3_2*α*_6 − 3*ν*^4*d*^2_2 *α*_4 + 5*ω*(*α*_5 − 3*ωα*_6) + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *.*

Then, We get the following dark soliton. (9) 216*α*_4 − 72L*α*_4 + 810*α*_3*α*_5*α*_4 − 15*α*_5 (14L*α*_3 + 25*α*_5) *α*_4 + 25 (18*α*_3 + 5L) *α*_5 When {*d*_0 = *d*_1 = 0*, d*_2 =_{4d4} }, we get the following result. *c*_0 = √ *, c*_1 = *i d*_4 *ν, c*_{−1} = 0*,*  4 *d*_4 *k* = _3 5*α*_6*d*_3*ν* − 24*d*_4*d*_3*ν* (5*ω*(*α*_5 − 3*α*_6*ω*) + *α*_4) 1024*d*_4  + 64*d*_4*d*_3*ν* 30*α*_6*ω* − 4*ω* (5*α*_5*ω* + 3*α*_4) + 6*α*_3*ω* + 1 + 512*d*_4*ω* 2*ω*(*α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3) + 1 *.*

Then, the preceding result yields the following dark soliton. *ψ*(*x, t*) = − √ *.* (10) 2 *d*_4 (−216*α*_4^4 − 810*α*_3*α*_5*α*_4^2 + 72*α*_4^3L + 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) − 25*α*_5^2 (18*α*_3^2 + 5L))

### Singular periodic solutions and singular solitons

When {*d*_3 = *d*_4 = *d*_1 = 0}, we get the following solution set : *c*_0 = *c*_1 = 0*, c*_{−1} = −*d*_0 *ν, k* = 2*ω α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3 − 2*α*_6*d*_2*ν* − 2*d*_2*ν* (5*ω*(*α*_5 − 3*α*_6*ω*) + *α*_4) − *d*_2*ν* 30*α*_6*ω* − 4*ω* (5*α*_5*ω* + 3*α*_4) + 6*α*_3*ω* + 1 + *ω .*

Consequently, we obtain the following singular periodic solution and singular soliton, respectively. 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L) 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L) When {*d*_1 = *d*_3 = 0, *d*_0 =_{4d4} }, we obtain the following results.

*Result 1*

 *id*_2*ν* *c*_{−1} = √ *, c*_0 = *c*_1 = 0*,*  2 *d*_4 *k* =^1_2 − 5*ν*^6*d*^3_2*α*_6 − 3*ν*^4*d*^2_2(*α*_4 + 5*ω*(*α*_5 − 3*ωα*_6)) + *ω*^2 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω*^3*α*_6)  + *ν*^2*d* − 1 − 6*ωα* + 2*ω*^2(6*α* + 5*ω*(2*α* − 3*ωα* )) *.* Consequently, the previous result admits the following singular periodic solution, and singular soliton, respectively. *ψ*(*x, t*) = √ *,* (13) *d*_2 (216*α*_4^4 + 810*α*_3*α*_5*α*_4^2 − 72*α*_4^3L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5^2 (18*α*_3^2 + 5L)) *ψ*(*x, t*) = √ *.* (14) *d*_2 (216*α*_4^4 + 810*α*_3*α*_5*α*_4^2 − 72*α*_4^3L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5^2 (18*α*_3^2 + 5L))

*Result 2* *c*_0 = 0*, c*_1 = *i d*_4 *ν, c*_{−1} = √ *,*  2 *d*_4 *k* =^1_2 − 5*ν*^6*d*^3_2*α*_6 − 3*ν*^4*d*^2_2 *α*_4 + 5*ω*(*α*_5 − 3*ωα*_6)  + *ω*^2 1 + 2*ω*(*α* − *ω*(*α* + *ωα* ) + *ω*^3*α* ) + *ν*^2*d* − 1 − 6*ωα* + 2*ω*^2(6*α* + 5*ω*(2*α* − 3*ωα* )) *.* Then, we associate with the preceding solution set, the following singular soliton, and singular periodic solution, respectively. −216*α*_4 − 810*α*_3*α*_5*α*_4 + 72*α*_4L + 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) − 25*α*_5 (18*α*_3 + 5L) 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L)

When {*d*_0 = *d*_1 = *d*_3 = 0}, we attain the following result. *k* =^1_2 *ω*^2 − 2*ν*^6*d*^3_2*α*_6 + 2*ω*^3 *α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω*^3*α*_6 − *ν d*_2 1 + 6*ωα*_3 − 4*ω* (3*α*_4 + 5*ωα*_5) + 30*ω α*_6 − 2*ν d*_2 *α*_4 + 5*ω*(*α*_5 − 3*ωα*_6) *.*

Then, the following singular periodic solution is obtained 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L) When {*d*_1 = *d*_3 = 0, *d*_0 =_{4d4} }, the following result is obtained. *k* =^1_2 − 5*ν*^6*d*^3_2*α*_6 − 3*ν*^4*d*^2_2 *α*_4 + 5*ω*(*α*_5 − 3*ωα*_6) + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *.*

Then, the latter admits the following singular periodic solution. (18) 216*α*_4 − 72L*α*_4 + 810*α*_3*α*_5*α*_4 − 15*α*_5 (14L*α*_3 + 25*α*_5) *α*_4 + 25 (18*α*_3 + 5L) *α*_5

### Jacobi elliptic functions and weierstrass solution

*Result 1* *c*_1 = −*d*_4 *ν, c*_0 = *c*_{−1} = 0*, k* = *ω α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3 − *d*_2*ν* 30*α*_6*ω* − 4*ω* (5*α*_5*ω* + 3*α*_4) + 6*α*_3*ω* + 1 which admits the following Jacobi elliptic function solution. (19) 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L)

*Result 2* *c*_1 = *c*_0 = 0*, c*_{−1} = √ *id*^2*m m* − 1 *ν ,*  −4*d m*^4 + 4*d m*^2 − *d k* = *ω α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3 − *d*_2*ν* 30*α*_6*ω* − 4*ω* (5*α*_5*ω* + 3*α*_4) + 6*α*_3*ω* + 1  2 which admits another Jacobi elliptic solution. *ψ*(*x, t*) = √ *.* (20) *d*_2 (2*m*^2 − 1) (216*α*_4^4 + 810*α*_3*α*_5*α*_4^2 − 72*α*_4^3L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5^2 (18*α*_3^2 + 5L)) When {*d*_1 = *d*_3 = 0, *d*_0 = _{2 2} }, we get the following results. *Result 1* *c*_0 = *c*_{−1} = 0*, c*_1 = −*d*_4 *ν,*  + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *.*

Then, we obtain the following Jacobi elliptic function solution. (21) 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L)

*Result 2* *c*_1 = *c*_0 = 0*, c*_{−1} = √ *id*^2*m m* − 1 *ν ,*  −4*d*_4*m*^4 + 4*d*_4*m*^2 − *d*_4 + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *,*

which admits another Jacobi elliptic function solution. *m* 2 − *m*^2 (216*α*_4^4 + 810*α*_3*α*_5*α*_4^2 − 72*α*_4^3L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5^2 (18*α*_3^2 + 5L)) *Result 1* *c*_0 = *c*_{−1} = 0*, c*_1 = −*d*_4 *ν,*  + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *,*

which reads the following Jacobi elliptic solution. 1250*α*_5 _{m2+1} sn *ζ* −_{m2+1} ∣ *m* × *e* (23) 216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L)

*Result 2*

 *d mν*  −*d*_4*m*^4 − 2*d*_4*m*^2 − *d*_4 + *ω* 1 + 2*ω*(*α*_3 − *ω*(*α*_4 + *ωα*_5) + *ω α*_6) + *ν d*_2 − 1 − 6*ωα*_3 + 2*ω* (6*α*_4 + 5*ω*(2*α*_5 − 3*ωα*_6)) *,*

which derive the following Jacobi elliptic solution.

( √ ∣ )_{−1} 1250*α*_5*d*_2sn *ζ* −_{m2+1} ∣ *m* × *e* _{d4} (216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L))

When {*d*_2 = *d*_4 = 0}, the following result is revealed. *c*_{−1} = −*d*_0 *ν, c*_1 = 0*,* −*d*_0 *ν*^3 *ν*  *k* = *ω α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3 − 3*c*_0 30*α*_6*ω* − 4*ω* (5*α*_5*ω* + 3*α*_4) + 6*α*_3*ω* + 1 2

Then, we attain the following Weierstrass elliptic function solution.

### Exponential solution

When {*d*3 = *d*4 = 0*, d*0 =_{4d2} }, the following result is obtained. *c*_1 = 0*, c*_0 = *i d*_2 *ν, c*_{−1} = √ *, k* = 8*ω* 2*ω*(*α*_6*ω* − *ω*(*α*_5*ω* + *α*_4) + *α*_3) + 1 + 5*α*_6*d*_2*ν*  16 Then, We obtain the following exponential solution. (26) (216*α*_4 + 810*α*_3*α*_5*α*_4 − 72*α*_4L − 15*α*_5*α*_4 (25*α*_5 + 14*α*_3L) + 25*α*_5 (18*α*_3 + 5L))

**Fig. 1.** Bright soliton solution of Eq. (8) visualized in two and three dimensions under identical parameter settings: *d*_2 = 3, *α*_3 = 5, *α*_4 = 2, and *α*_5 = 1, and in three different time instances *t* = 1*,* 5*,* 10.

**Fig. 2.** Dark soliton solution for Eq. (9) visualized in two and three dimensions under identical parameter settings: *d*_2 = −1, *α*_3 = 3, *α*_4 = 1*.*5, and *α*_5 = 1, and in three different time instances *t* = 1*,* 5*,* 10.

## Results and discussion

This section presents the dynamical behavior of the obtained solutions for the sixth–order integrable NLSE. Five classes of nonlinear wave structures are examined: bright solitons, dark solitons, singular solitons, singular periodic solutions, and Jacobi elliptic solutions. In the case of the Jacobi elliptic solution, the relation and transition between the periodic and localized (soliton) structures are demonstrated. For each case, both 2D and 3D plots illustrate the evolution of the wave amplitude over space and time, confirming the analytical results.

### Bright soliton dynamics

Figure 1 shows the bright soliton solution defined by Eq. (8), represented in both two and three dimensions under identical parameter settings: *d*_2 = 3, *α*_3 = 5, *α*_4 = 2, and *α*_5 = 1, and shown at three different snapshots. Bright solitons retain a localized peak as they propagate, owing to the balance between dispersion and nonlinear self-focusing. The soliton maintains its amplitude and width for all plotted time instances *t* = 1*,* 5*,* 10, demonstrating stable and localized propagation.

### Dark soliton dynamics

Figure 2 displays the dark soliton solution governed by Eq. (9), visualized in both two and three dimensions under identical parameter settings: *d*_2 = −1, *α*_3 = 3, *α*_4 = 1*.*5, and *α*_5 = 1, and in three different time instances. Unlike bright solitons, dark solitons exhibit a localized dip on a continuous background. The structure remains stable for all time levels, reflecting the phase–shifted wave nature observed in defocusing nonlinear media.

### Singular soliton behavior

Figure 3 illustrates the singular soliton solution of Eq. (14), visualized in both two and three dimensions under identical parameter settings: *d*_2 = −0*.*01, *α*_3 = 0*.*5, *α*_4 = −3, *α*_5 = −1*.*5, and in three different time instances. Singular solitons represent a special class of nonlinear wave structures characterized by an infinite or extremely large amplitude at specific spatial points. Such solutions often arise in physical systems where nonlinear effects dominate over dispersion, leading to energy localization and field blow-up. In applications, singular solitons can model intense wave focusing in optical fibers, plasma collapses, or energy concentration in shallow-water dynamics. Singular solitons develop sharp peaks, indicating points where the amplitude becomes extremely large due to dominant nonlinear amplification. The plots show steep localized gradients, highlighting wave concentration phenomena.

**Fig. 3.** Singular soliton solution for Eq. (14), visualized in two and three dimensions under identical parameter settings: *d*_2 = −0*.*01, *α*_3 = 0*.*5, *α*_4 = −3, *α*_5 = −1*.*5, and in three different time instances *t* = 1*,* 5*,* 10.

**Fig. 4.** Singular periodic solution for Eq. (17) visualized in two and three dimensions under identical parameter settings: *d*_2 = −2, *α*_3 = −5, *α*_4 = −1, *α*_5 = −2*.*7, and in three different time instances *t* = 1*,* 5*,* 10.

### Singular periodic wave profiles

Figure 4 corresponds to the singular periodic solution of Eq. (17), visualized in both two and three dimensions under identical parameter settings: *d*_2 = −2, *α*_3 = −5, *α*_4 = −1, *α*_5 = −2*.*7, and in three different time instances. These structures periodically develop singular behavior, combining periodic oscillations with sharp amplitude spikes. The plots clearly show repeating localized peaks, indicating strong nonlinear modulation across each period.

### Jacobi elliptic functions and their connection to periodic and soliton solutions

The Jacobi elliptic functions sn(*u, m*), cn(*u, m*), and dn(*u, m*) arise naturally in the analysis of nonlinear evolution equations. Depending on the modulus *m* (0 ≤ *m* ≤ 1), they bridge trigonometric and hyperbolic behaviors, thereby linking periodic and soliton solutions. For *m* → 0, they reduce to trigonometric functions:

sn(*u,* 0) = sin(*u*)*,* cn(*u,* 0) = cos(*u*)*,* dn(*u,* 0) = 1*,*

while for *m* → 1, they become hyperbolic:

**Fig. 5.** The Jacobi elliptic function cn(*ζ, m*) in Eq. (19) is illustrated in 3D, showing the transition from singular periodic to regular periodic waves and finally to a bright soliton as the modulus *m* → 1, with *d*_2 = 2, *α*_3 = −3, *α*_4 = 2, and *α*_5 = −1.

**Fig. 6.** The Jacobi elliptic function cn(*ζ, m*) in Eq. (19) is illustrated in 2D, showing the evolution from singular periodic to regular periodic waves and ultimately to a bright soliton as the modulus *m* → 1, with *d*_2 = 2, *α*_3 = −3, *α*_4 = 2, and *α*_5 = −1, at three representative times *t* = 1*,* 5*,* 10*.*.

sn(*u,* 1) = tanh(*u*)*,* cn(*u,* 1) = sech(*u*)*,* dn(*u,* 1) = sech(*u*)*.*

Thus, varying the modulus *m* from 0 to 1 gradually transforms the periodic Jacobi–elliptic waves into solitary structures. Figure 5 illustrates the evolution of the cn(*ζ, m*) solution in Eq.(19), showing its transition from singular periodic (arising when the argument becomes complex) to regular periodic and finally to brightsoliton profiles in 3D, under the parameter set *d*_2 = 2, *α*_3 = −3, *α*_4 = 2, and *α*_5 = −1. Figure 6 presents the corresponding 2D profiles for the same parameter values at three representative times *t* = 1*,* 5*,* 10, highlighting the transition from singular periodic to regular periodic and ultimately to bright-soliton behavior.

Overall, the graphical results validate the analytical solutions and demonstrate the complex propagation patterns permitted by the sixth–order NLSE model. The figures highlight the structural evolution, stability characteristics, and nonlinear effects associated with each solution type.

## Conclusion

In this work, we investigated the sixth-order integrable nonlinear Schrödinger equation within its hierarchy and extended the analytical solution landscape of this model. Using the Improved Modified Extended Tanh Function Method (IMETFM), we systematically derived new families of exact solutions, including bright, dark, singular solitons, singular periodic solutions, and Jacobi and Weierstrass elliptic waveforms.

The novelty of this study lies in providing a unified analytical framework for the sixth-order NLSE that captures localized solitons, singular dispersive structures, and doubly-periodic nonlinear waves. The results demonstrate that higher-order dispersion and nonlinear effects significantly enrich the dynamics compared with the classical NLSE, producing additional wave morphologies and amplitude profiles absent in lower-order models.

Two- and three-dimensional graphical simulations illustrate the propagation, intensity localization, and periodic modulation of the solutions, confirming distinct physical signatures, particularly the sharp energy concentration of singular solitons and the smooth periodic patterns of elliptic solutions.

Physically, higher-order dispersive and nonlinear terms enable a broader range of self-trapped and periodic behaviors. Bright and dark solitons correspond to localized energy packets and intensity depressions, while singular solitons represent ultra-localized energy spikes that can model collapse-like events. Jacobi and Weierstrass elliptic solutions bridge localized and periodic states, showing how continuous modulation of the elliptic modulus transitions the system from periodic oscillations to solitary waves, highlighting the delicate balance between dispersion and nonlinearity.

Overall, these findings underline the physical relevance of the sixth-order NLSE hierarchy and the effectiveness of IMETFM for constructing complex analytical waveforms. Future work may explore stability analysis, perturbation dynamics, and parameter sensitivity.

## Data availability

The datasets used and/or analyzed during the current study are available from the corresponding author upon reasonable request.

Received: 5 September 2025; Accepted: 27 November 2025

## Acknowledgements

Not Applicable.

## Author contributions

Mina M. Fahim: Formal analysis, Software, Methodology; Hamdy M. Ahmed: Validation, Methodology; K. A. Dib: Resources, Writing–review & editing; Islam Samir: Software, Investigation.

## Funding

Open access funding provided by The Science, Technology & Innovation Funding Authority (STDF) in cooperation with The Egyptian Knowledge Bank (EKB).

## Declarations

## Competing interests

The authors declare no competing interests.

## Additional information

Correspondence and requests for materials should be addressed to M.M.F.

Reprints and permissions information is available at www.nature.com/reprints.

Publisher’s note Springer Nature remains neutral with regard to jurisdictional claims in published maps and institutional affiliations.

Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons licence, and indicate if changes were made. The images or other third party material in this article are included in the article’s Creative Commons licence, unless indicated otherwise in a credit line to the material. If material is not included in the article’s Creative Commons licence and your intended use is not permitted by statutory regulation or exceeds the permitted use, you will need to obtain permission directly from the copyright holder. To view a copy of this licence, visit http://creativecommons.org/licenses/by/4.0/.

© The Author(s) 2025

## References

- [1] Mohan, B., Kumar, S. & Kumar, R. On investigation of kink-solitons and rogue waves to a new integrable (3+ 1)-dimensional KdV- type generalized equation in nonlinear sciences. *Nonlinear Dyn.* 113(9), 10261–10276 (2025).
- [2] Mohan, B. & Kumar, S. Rogue-wave structures for a generalized (3+1)-dimensional nonlinear wave equation in liquid with gas bubbles. *Phys. Scr.* 99(10), 105291 (2024).
- [3] Mohan, B., Kumar, S. & Kumar, R. Higher-order rogue waves and dispersive solitons of a novel P-type (3+1)-D evolution equation in soliton theory and nonlinear waves. *Nonlinear Dyn.* 111(21), 20275–20288 (2023).
- [4] Ankiewicz, A., Soto-Crespo, M. & Akhmediev, N. Rogue waves and rational solutions of the Hirota equation. *Phys. Rev. E* 81(4), 046602 (2010).
- [5] Serkin, V. N. & Belyaeva, T. L. Optimal control for soliton breathers of the Lakshmanan-Porsezian-Daniel, Hirota, and cmKdV models. *Optik* 175, 17–27 (2018).
- [6] Kudryashov, N. A. The Lakshmanan-Porsezian-Daniel model with arbitrary refractive index and its solution. *Optik* 241, 167043 (2021).
- [7] Iqbal, I. Soliton unveilings in optical fiber transmission: Examining soliton structures through the Sasa-Satsuma equation. *Results in Physics* 60, 107648 (2024).
- [8] Younas, T., & Ahmad, J. Dynamical behavior of the higher-order cubic-quintic nonlinear Schrödinger equation with stability analysis. *J. Opt.* 1–23 (2024)
- [9] Mostafa, M. A. et al. Langmuir wave dynamics and plasma instabilities: Insights from generalized coupled nonlinear Schrödinger equations. *Mod. Phys. Lett. B* 38(36), 2450366 (2024).
- [10] Ankiewicz, A., Kedziora, D. J., Chowdury, A., Bandelow, U. & Akhmediev, N. Infinite hierarchy of nonlinear Schrödinger equations and their solutions. *Phys. Rev. E* 93(1), 012206 (2016).
- [11] Chowdury, A. & Krolikowski, W. Breather-to-soliton transformation rules in the hierarchy of nonlinear Schrödinger equations. *Phys. Rev. E* 95(6), 062226 (2017).
- [12] Mathanaranjan, T. Solitary wave structures, conservation laws and dynamical analysis of the Heisenberg ferromagnet-type equation. *Mod. Phys. Lett. B* 2025, 2550229 (2025).
- [13] Khatri, H., Malik, A. & Gautam, M. G. Traveling, periodic and localized solitary waves solutions of the (4+1)-dimensional nonlinear Fokas equation. *SN Appl. Sci.* 2(11), 1829 (2020).
- [14] El Sheikh, M. M. A. et al. Optical solitons with differential group delay for coupled Kundu-Eckhaus equation using extended simplest equation approach. *Optik* 208, 164051 (2020).
- [15] Mathanaranjan, T., Hashemi, M. S., Rezazadeh, H., Akinyemi, L. & Bekir, A. Chirped optical solitons and stability analysis of the nonlinear Schrödinger equation with nonlinear chromatic dispersion. *Commun. Theor. Phys.* 75(8), 085005 (2023).
- [16] El-Ganaini, S. & Kumar, H. A variety of new soliton structures and various dynamical behaviors of a discrete electrical lattice with nonlinear dispersion via variety of analytical architectures. *Math. Methods Appl. Sci.* 46(2), 2746–2772 (2023).
- [17] Kumar, H. & Chand, F. Optical solitary wave solutions for the higher order nonlinear Schrödinger equation with self-steepening and self-frequency shift effects. *Opt. Laser Technol.* 54, 265–273 (2013).
- [18] Ibrahim, S., Ashir, A. M., Sabawi, Y. A. & Baleanu, D. Realization of optical solitons from nonlinear Schrödinger equation using modified Sardar sub-equation technique. *Opt. Quant. Electron.* 55(7), 617 (2023).
- [19] Ali, M. H., El-Owaidy, H. M., Ahmed, H. M., El-Deeb, A. A. & Samir, I. Optical solitons and complexitons for generalized Schrödinger-Hirota model by the modified extended direct algebraic method. *Opt. Quant. Electron.* 55(8), 675 (2023).
- [20] Vahidi, J., Zabihi, A., Rezazadeh, H. & Ansari, R. New extended direct algebraic method for the resonant nonlinear Schrödinger equation with Kerr law nonlinearity. *Optik* 227, 165936 (2021).
- [21] Rabiea, W. B., Hussein, H. H., Ahmed, H. M., Alnahhass, M. & Alexan, W. Abundant solitons for highly dispersive nonlinear Schrödinger equation with sextic-power law refractive index using modified extended direct algebraic method. *Alex. Eng. J.* 86, 680–689 (2024).
- [22] Fahim, M. M., Ahmed, H. M., Dib, K. A., & Samir, I. Derivation of dispersive solitons with quadrupled power law of nonlinearity using improved modified extended tanh function method. *J. Opt.* 1–10 (2024).
- [23] Samir, I. et al. Unraveling solitons dynamics in system of dispersive NLSE with Kudryashov’s law of nonlinearity using improved modified extended tanh function method. *Alexandria Eng. J.* 91, 419–428 (2024).
- [24] Samir, I. & Ahmed, H. M. Retrieval of solitons and other wave solutions for stochastic nonlinear Schrödinger equation with nonlocal nonlinearity using the improved modified extended tanh-function method. *J. Opt.* 1–10 (2024)
- [25] Farooq, A., Muhammad, I. K. & MA, W. X. Exact solutions for the improved mKdv equation with conformable derivative by using the Jacobi elliptic function expansion method. *Opt. Quant. Electron.* 56(4), 542 (2024).
- [26] Kumar, H. & Chand, F. Chirped and chirpfree soliton solutions of generalized nonlinear Schrödinger equation with distributed coefficients. *Optik* 125(12), 2938–2949 (2014).
- [27] Ali Akbar, M. et al. Soliton solutions to the Boussinesq equation through sine-Gordon method and Kudryashov method. *Results Phys.* 25, 104228 (2021).
- [28] Mohan, B. & Kumar, S. Painlevé analysis, restricted bright-dark N-solitons, and N-rogue waves of a (4+1)-dimensional variablecoefficient generalized KP equation in nonlinear sciences. *Nonlinear Dyn.* 113(10), 11893–11906 (2025).
- [29] Kumar, S. & Mohan, B. A direct symbolic computation of center-controlled rogue waves to a new Painlevé-integrable (3+1)-D generalized nonlinear evolution equation in plasmas. *Nonlinear Dyn.* 111(17), 16395–16405 (2023).
- [30] Mohan, B. & Kumar, S. Generalization and analytic exploration of soliton solutions for nonlinear evolution equations via a novel symbolic approach in fluids and nonlinear sciences. *Chin. J. Phys.* 92, 10–21 (2024).
- [31] Mathanaranjan, T. The fractional perturbed nonlinear Schrödinger equation in nanofibers: Soliton solutions and dynamical behaviors. *Comput. Model. Fract. Order Syst.* 75(8), 155–167 (2024).
- [32] Mathanaranjan, T., Yesmakhanova, K., Myrzakulov, R. & Naizagarayeva, A. Optical wave structures and stability analysis of integrable Zhanbota equation. *Mod. Phys. Lett. B* 39(22), 2550071 (2025).
- [33] Mathanaranjan, T., Tharsana, S. & Dilakshi, G. Solitonic wave structures and stablility analysis for the M-fractional generalized coupled nonlinear Schrödinger-KdV equations. *Int. J. Appl. Comput. Math.* 10(6), 165 (2024).
